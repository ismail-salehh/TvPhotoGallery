import { jpegUrl } from '../../src/api/imageUrl';

const RAW = 'https://images.unsplash.com/photo-1?ixid=abc&ixlib=rb-4.1.0';

describe('jpegUrl', () => {
  it('asks imgix for JPEG when the URL names no format', () => {
    expect(jpegUrl(RAW)).toBe(`${RAW}&fm=jpg`);
  });

  it('replaces any format the server put in, and format negotiation', () => {
    const url = 'https://plus.unsplash.com/p?fm=avif&auto=format&q=80';
    expect(jpegUrl(url)).toBe('https://plus.unsplash.com/p?q=80&fm=jpg');
  });

  it('sets each param once, replacing the value already there', () => {
    const url = 'https://images.unsplash.com/p?w=400&q=75&cs=tinysrgb';
    expect(jpegUrl(url, { w: 1920, q: 80 })).toBe(
      'https://images.unsplash.com/p?cs=tinysrgb&w=1920&q=80&fm=jpg',
    );
  });

  it('adds a query to a URL without one and keeps its fragment', () => {
    expect(jpegUrl('https://images.unsplash.com/p#top', { w: 10 })).toBe(
      'https://images.unsplash.com/p?w=10&fm=jpg#top',
    );
  });

  it('drops empty pairs and encodes values', () => {
    expect(jpegUrl('https://images.unsplash.com/p?&a=1&', { t: 'a b' })).toBe(
      'https://images.unsplash.com/p?a=1&t=a%20b&fm=jpg',
    );
  });

  it('leaves URLs of other hosts alone: their format is not ours to set', () => {
    const other = 'https://example.com/p.avif?fm=avif';
    expect(jpegUrl(other, { w: 1 })).toBe(other);
    // Look-alike hosts are not imgix
    const lookalike = 'https://images.unsplash.com.evil.test/p';
    expect(jpegUrl(lookalike)).toBe(lookalike);
  });

  it('never leaves two formats in the URL, whatever comes in', () => {
    const inputs = [
      RAW,
      `${RAW}&fm=webp`,
      `${RAW}&fm=avif&fm=png`,
      `${RAW}&auto=format,compress`,
    ];
    for (const input of inputs) {
      const out = jpegUrl(input, { w: 1920 });
      expect(out.match(/[?&]fm=/g)).toHaveLength(1);
      expect(out).toMatch(/[?&]fm=jpg(&|$)/);
      expect(out).not.toMatch(/[?&]auto=/);
    }
  });
});
