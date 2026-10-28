import { pageUrl } from '../../scripts/qa/lib.mjs';

describe('pageUrl', () => {
  it('adds the query at a server root', () => {
    expect(pageUrl('http://localhost:8091', 'perf=1#/album/a')).toBe(
      'http://localhost:8091/?perf=1#/album/a',
    );
  });

  it('adds it to an installed app’s index.html, as on a webOS TV', () => {
    const app =
      'file:///media/developer/apps/usr/palm/applications/com.tvphotogallery/index.html';
    expect(pageUrl(app, 'qa=2')).toBe(`${app}?qa=2`);
  });
});
