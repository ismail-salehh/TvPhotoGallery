// Catches errors nothing else handled. `onError` saves its report before
// React Native's own handler runs, which on a fatal error ends the app.
// Web version: crashHooks.web.ts.

type OnError = (error: unknown, fatal: boolean) => Promise<void>;
type ErrorHandler = (error: unknown, isFatal?: boolean) => void;
type RejectionOptions = {
  allRejections: boolean;
  onUnhandled: (id: number, error: unknown) => void;
};

declare const ErrorUtils: {
  getGlobalHandler: () => ErrorHandler;
  setGlobalHandler: (handler: ErrorHandler) => void;
};

// Longest a fatal error waits for its report to be saved
const SAVE_TIMEOUT_MS = 1000;

const settled = (work: Promise<void>) =>
  Promise.race([
    work.catch(() => {}),
    new Promise<void>(resolve => setTimeout(resolve, SAVE_TIMEOUT_MS)),
  ]);

export function addCrashListener(onError: OnError) {
  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    settled(onError(error, !!isFatal)).then(() => previous(error, isFatal));
  });

  // Release builds track no unhandled rejections at all; this tracker
  // replaces the dev one, so it keeps its warning
  const hermes = (
    globalThis as {
      HermesInternal?: {
        enablePromiseRejectionTracker?: (options: RejectionOptions) => void;
      };
    }
  ).HermesInternal;
  hermes?.enablePromiseRejectionTracker?.({
    allRejections: true,
    onUnhandled: (_id, error) => {
      if (__DEV__) {
        console.warn('Possible unhandled promise rejection:', error);
      }
      onError(error, false).catch(() => {});
    },
  });

  return () => ErrorUtils.setGlobalHandler(previous);
}
