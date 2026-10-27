import { Linking } from 'react-native';

// The link the app was launched with, or null. Web version: deepLink.web.ts.
export function getInitialLink(): Promise<string | null> {
  return Linking.getInitialURL().then(
    url => url ?? null,
    () => null,
  );
}

// Links opened while the app is already running
export function addLinkListener(listener: (url: string) => void) {
  const subscription = Linking.addEventListener('url', ({ url }) =>
    listener(url),
  );
  return () => subscription.remove();
}
