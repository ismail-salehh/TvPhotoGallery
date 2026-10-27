import { ACCESS_KEY } from '@env';

const BASE_URL = 'https://api.unsplash.com';

// Requests that hang (flaky Wi-Fi is common on TVs) fail after this long
// instead of leaving a spinner up forever
const TIMEOUT_MS = 15000;

// The server answered with an error status
export class UnsplashError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// The server could not be reached at all: offline or DNS failure
export class NetworkError extends Error {}

// Reached, but no complete answer within TIMEOUT_MS
export class TimeoutError extends Error {}

// Unsplash answers 403 once the key's hourly request quota is used up
export const isRateLimited = (error: unknown) =>
  error instanceof UnsplashError && error.status === 403;

// No such photo or album, e.g. from a stale link
export const isNotFound = (error: unknown) =>
  error instanceof UnsplashError && error.status === 404;

// The timeout covers reading the body too: a response whose body never
// finishes would otherwise leave a spinner up forever
async function fetchWithTimeout<R>(
  url: string,
  init: RequestInit,
  read: (response: Response) => Promise<R>,
): Promise<R> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  try {
    return await read(await fetch(url, { ...init, signal: controller.signal }));
  } catch (e) {
    if (e instanceof UnsplashError) {
      throw e;
    }
    if (e instanceof SyntaxError) {
      throw new UnsplashError(0, `Unreadable response: ${url}`);
    }
    throw timedOut
      ? new TimeoutError(`No answer within ${TIMEOUT_MS} ms: ${url}`)
      : new NetworkError((e as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

// Images fail without saying why, so after an image error this tells
// "the device is offline" apart from "this one image is broken"
export async function isOnline() {
  try {
    // no-cors: any answer at all proves the network works, and browsers
    // would otherwise reject the unauthenticated cross-origin request
    await fetchWithTimeout(
      BASE_URL,
      { method: 'HEAD', mode: 'no-cors' },
      async () => undefined,
    );
    return true;
  } catch {
    return false;
  }
}

export type UnsplashResult<T> = {
  data: T;
  // Unsplash returns the total count of list endpoints in the X-Total header
  total: number;
};

export async function unsplashGet<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<UnsplashResult<T>> {
  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  ).toString();

  return fetchWithTimeout(
    `${BASE_URL}${path}${query ? `?${query}` : ''}`,
    {
      headers: {
        Authorization: `Client-ID ${ACCESS_KEY}`,
        'Accept-Version': 'v1',
      },
    },
    async response => {
      if (!response.ok) {
        throw new UnsplashError(
          response.status,
          `Unsplash request failed: ${response.status} ${path}`,
        );
      }
      const data = (await response.json()) as T;
      const total = Number(response.headers.get('X-Total') ?? 0);
      return { data, total };
    },
  );
}
