import { domDocument, domWindow } from './webDom';

// In a browser the link is the page address, with the app's path after "#"
// (…/#/photo/<id>), so it needs no server routes. An LG TV passes it in the
// launch parameters instead: {"target": "tvphotogallery://photo/<id>"}.

type WebOSSystem = { launchParams?: string };

function launchTarget() {
  const g = globalThis as {
    webOSSystem?: WebOSSystem;
    PalmSystem?: WebOSSystem;
  };
  try {
    const params = JSON.parse(
      (g.webOSSystem ?? g.PalmSystem)?.launchParams || '{}',
    );
    return typeof params.target === 'string' ? (params.target as string) : null;
  } catch {
    return null;
  }
}

// The address's link, cleared once read so the same link opened again
// later is a change the app hears about
function takeHashLink() {
  const { hash, href, pathname, search } = domWindow.location;
  if (!hash.startsWith('#/')) {
    return null;
  }
  domWindow.history.replaceState(null, '', pathname + search);
  return href;
}

export function getInitialLink(): Promise<string | null> {
  return Promise.resolve(launchTarget() ?? takeHashLink());
}

export function addLinkListener(listener: (url: string) => void) {
  const onHashChange = () => {
    const link = takeHashLink();
    if (link) {
      listener(link);
    }
  };
  // webOS relaunches a running app rather than starting a second one
  const onRelaunch = () => {
    const link = launchTarget();
    if (link) {
      listener(link);
    }
  };
  domWindow.addEventListener('hashchange', onHashChange);
  domDocument.addEventListener('webOSRelaunch', onRelaunch);
  return () => {
    domWindow.removeEventListener('hashchange', onHashChange);
    domDocument.removeEventListener('webOSRelaunch', onRelaunch);
  };
}
