// Unsplash serves images through imgix, where format and size are query
// parameters. Older TV browsers (webOS 22 is Chromium 87) can't be trusted
// with AVIF or with format negotiation, so every image is asked for as JPEG.
const IMGIX_HOST = /^https:\/\/(images|plus)\.unsplash\.com\//;

// `auto=format` would let imgix pick the format from the Accept header
const DROPPED = new Set(['auto', 'fm']);

type ImageParams = Record<string, string | number>;

// `url` with `params` set (replacing any value it already had) and JPEG as
// the format. A URL from any other host is returned unchanged.
export function jpegUrl(url: string, params: ImageParams = {}) {
  if (!IMGIX_HOST.test(url)) {
    return url;
  }
  const [rest, fragment] = splitOnce(url, '#');
  const [base, query] = splitOnce(rest, '?');
  const kept = (query ?? '').split('&').filter(pair => {
    const name = splitOnce(pair, '=')[0];
    return name !== '' && !DROPPED.has(name) && !(name in params);
  });
  const added = Object.entries({ ...params, fm: 'jpg' }).map(
    ([name, value]) => `${name}=${encodeURIComponent(String(value))}`,
  );
  const hash = fragment === undefined ? '' : `#${fragment}`;
  return `${base}?${[...kept, ...added].join('&')}${hash}`;
}

function splitOnce(text: string, separator: string): [string, string?] {
  const at = text.indexOf(separator);
  return at === -1 ? [text] : [text.slice(0, at), text.slice(at + 1)];
}
