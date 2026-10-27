// Types for the tests that import lib.mjs
export function physicalKey(key: string, rtl: boolean): string;
export function matches(
  id: string | null,
  pattern: string,
  captures?: Record<string, string>,
): boolean;
export function wentTheRightWay(a: object, b: object, key: string): boolean;
export function staysInRow(a: object, b: object): boolean;
export function onScreen(rect: object, viewport: object): boolean;
export function runCheck(
  driver: object,
  check: object,
  opts: object,
): Promise<{ ok: boolean; failures: string[] }>;
export function walkScreen(
  driver: object,
  walk: object,
  opts: { rtl: boolean; links: object; budget?: number },
): Promise<{ ok: boolean; issues: string[]; items?: number; edges?: number }>;
export function runAll(
  driver: object,
  spec: object,
  opts: { languages: string[]; only?: 'checks' | 'walks' },
): Promise<
  { language: string; kind: 'check' | 'walk'; name: string; ok: boolean }[]
>;
