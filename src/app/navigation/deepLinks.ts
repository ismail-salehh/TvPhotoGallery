export type LinkTarget = { kind: 'photo' | 'album'; id: string };

// tvphotogallery://photo/<id> or …/album/<id>; on the web the same path
// after "#". Ids are Unsplash's alphabet only, so a link can't steer the
// request it turns into elsewhere on the API.
const LINK =
  /^(?:tvphotogallery:\/\/|[^#]*#\/)(photo|album)\/([A-Za-z0-9_-]{1,64})\/?(?:[?#].*)?$/;

export function parseLink(url: string): LinkTarget | null {
  const match = LINK.exec(url);
  return match ? { kind: match[1] as LinkTarget['kind'], id: match[2] } : null;
}
