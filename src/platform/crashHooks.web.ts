import { domWindow } from './webDom';

type OnError = (error: unknown, fatal: boolean) => Promise<void>;
type ErrorEventLike = { error?: unknown; message?: string };
type RejectionEventLike = { reason?: unknown };

// Uncaught errors and unhandled promise rejections in the page
export function addCrashListener(onError: OnError) {
  const onPageError = (event: ErrorEventLike) => {
    onError(event.error ?? new Error(event.message), true).catch(() => {});
  };
  const onRejection = (event: RejectionEventLike) => {
    onError(event.reason, false).catch(() => {});
  };
  domWindow.addEventListener('error', onPageError);
  domWindow.addEventListener('unhandledrejection', onRejection);
  return () => {
    domWindow.removeEventListener('error', onPageError);
    domWindow.removeEventListener('unhandledrejection', onRejection);
  };
}
