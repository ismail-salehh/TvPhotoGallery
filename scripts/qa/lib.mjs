// Runs qa/key-sequences.json against a driver (web.mjs, android.mjs). A
// driver opens a start point, presses physical keys and reports focus as
// { id, rect } with rect = { x, y, width, height } in screen pixels.

const ARROWS = ['up', 'down', 'left', 'right'];
// Pixels a target may sit "behind" the direction pressed (rounding, scale)
const TOLERANCE = 4;

// start/end are left/right in LTR and right/left in RTL
export function physicalKey(key, rtl) {
  if (key === 'start') {
    return rtl ? 'right' : 'left';
  }
  if (key === 'end') {
    return rtl ? 'left' : 'right';
  }
  return key;
}

function resolve(pattern, captures) {
  return pattern.replace(/\$(\w+)/g, (_, name) => captures[name] ?? `$${name}`);
}

export function matches(id, pattern, captures = {}) {
  if (!id) {
    return false;
  }
  const resolved = resolve(pattern, captures);
  const regex = new RegExp(
    `^${resolved.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`,
  );
  return regex.test(id);
}

const center = r => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

// Whether moving from `a` to `b` went the way `key` points
export function wentTheRightWay(a, b, key) {
  const from = center(a);
  const to = center(b);
  return key === 'right'
    ? to.x >= from.x - TOLERANCE
    : key === 'left'
    ? to.x <= from.x + TOLERANCE
    : key === 'down'
    ? to.y >= from.y - TOLERANCE
    : to.y <= from.y + TOLERANCE;
}

// Left/right stay in the row: at its end nothing happens, rather than a
// diagonal jump to another row
export function staysInRow(a, b) {
  return a.y < b.y + b.height - TOLERANCE && b.y < a.y + a.height - TOLERANCE;
}

export function onScreen(rect, viewport) {
  return (
    rect.x >= -TOLERANCE &&
    rect.y >= -TOLERANCE &&
    rect.x + rect.width <= viewport.width + TOLERANCE &&
    rect.y + rect.height <= viewport.height + TOLERANCE
  );
}

export async function runCheck(driver, check, { rtl, links }) {
  const captures = {};
  const failures = [];
  await driver.open(check.start, links);
  for (const [index, step] of check.steps.entries()) {
    if (step.key) {
      await driver.press(physicalKey(step.key, rtl));
    }
    const focus = await driver.focus(step.wait ?? 0);
    const id = focus?.id ?? null;
    const label = `step ${index + 1}${step.key ? ` (${step.key})` : ''}`;
    if (!matches(id, step.expect, captures)) {
      failures.push(
        `${label}: expected ${resolve(step.expect, captures)}, focus on ${id}`,
      );
      break;
    }
    if (step.notExpect && matches(id, step.notExpect, captures)) {
      failures.push(`${label}: focus did not move from ${id}`);
      break;
    }
    if (step.capture) {
      captures[step.capture] = id;
    }
  }
  return { name: check.name, ok: failures.length === 0, failures };
}

// Shortest key path from `from` to any node satisfying `want`, over the
// edges seen so far
function pathTo(graph, from, want) {
  const queue = [[from, []]];
  const seen = new Set([from]);
  while (queue.length) {
    const [node, path] = queue.shift();
    if (want(node)) {
      return { node, path };
    }
    for (const [key, next] of graph.get(node) ?? []) {
      if (next && !seen.has(next)) {
        seen.add(next);
        queue.push([next, [...path, key]]);
      }
    }
  }
  return null;
}

export async function walkScreen(driver, walk, { rtl, links, budget = 200 }) {
  const issues = [];
  const graph = new Map();
  const rects = new Map();

  const begin = async () => {
    await driver.open(walk.start, links);
    for (const key of walk.setup ?? []) {
      await driver.press(physicalKey(key, rtl));
      await driver.focus(900);
    }
    return driver.focus(walk.settle ?? 1500);
  };

  let current = await begin();
  if (!current?.id) {
    return {
      name: walk.name,
      ok: false,
      issues: ['nothing focused at the start'],
    };
  }
  const viewport = await driver.viewport();
  const targets = new Map(
    (await driver.focusables())
      .filter(f => onScreen(f.rect, viewport))
      .map(f => [f.id, f.rect]),
  );
  rects.set(current.id, current.rect);
  const untested = id =>
    targets.has(id) && ARROWS.some(k => !(graph.get(id) ?? new Map()).has(k));

  let presses = 0;
  let restarts = 0;
  while (presses < budget) {
    let plan = pathTo(graph, current.id, untested);
    if (!plan && restarts < 5 && [...targets.keys()].some(untested)) {
      // Stranded where no known move leads back (a list scrolled): start over
      restarts += 1;
      current = await begin();
      plan = current?.id ? pathTo(graph, current.id, untested) : null;
    }
    if (!plan) {
      break;
    }
    // Get to the node, then try its first untested arrow
    let lost = false;
    for (const key of plan.path) {
      await driver.press(key);
      presses += 1;
      current = await driver.focus();
      if (!current?.id) {
        lost = true;
        break;
      }
    }
    if (lost) {
      current = await begin();
      continue;
    }
    if (current.id !== plan.node) {
      continue; // the screen changed under the walk; plan again from here
    }
    const key = ARROWS.find(k => !(graph.get(current.id) ?? new Map()).has(k));
    const from = current;
    await driver.press(key);
    presses += 1;
    const to = await driver.focus();
    const edges = graph.get(from.id) ?? new Map();
    graph.set(from.id, edges);
    edges.set(key, to?.id ?? null);
    if (!to?.id) {
      issues.push(`focus lost: ${key} from ${from.id}`);
      current = await begin();
      continue;
    }
    rects.set(to.id, to.rect);
    if (!onScreen(to.rect, viewport)) {
      issues.push(`off screen: ${key} from ${from.id} to ${to.id}`);
    }
    if (to.id !== from.id && !wentTheRightWay(from.rect, to.rect, key)) {
      issues.push(`wrong way: ${key} from ${from.id} to ${to.id}`);
    } else if (
      to.id !== from.id &&
      (key === 'left' || key === 'right') &&
      !staysInRow(from.rect, to.rect)
    ) {
      issues.push(`left the row: ${key} from ${from.id} to ${to.id}`);
    }
    current = to;
  }

  const reached = new Set([
    ...graph.keys(),
    ...[...graph.values()].flatMap(e => [...e.values()]),
  ]);
  const unreachable = [...targets.keys()].filter(id => !reached.has(id));
  if (unreachable.length) {
    issues.push(`not reachable: ${unreachable.join(', ')}`);
  }
  const untestedLeft = [...targets.keys()].filter(untested);
  if (untestedLeft.length && presses >= budget) {
    issues.push(`budget spent before testing: ${untestedLeft.join(', ')}`);
  }
  return {
    name: walk.name,
    ok: issues.length === 0,
    issues,
    items: targets.size,
    edges: [...graph.values()].reduce((n, e) => n + e.size, 0),
    presses,
  };
}

export async function runAll(driver, spec, { languages, only }) {
  const results = [];
  for (const language of languages) {
    await driver.setLanguage(language);
    const opts = { rtl: language === 'ar', links: spec.links };
    for (const check of spec.checks) {
      if (only && only !== 'checks') {
        break;
      }
      if (check.languages && !check.languages.includes(language)) {
        continue;
      }
      const result = {
        language,
        kind: 'check',
        ...(await runCheck(driver, check, opts)),
      };
      console.log(
        `${result.ok ? 'PASS' : 'FAIL'} [${language}] ${check.name}${
          result.ok ? '' : `\n     ${result.failures.join('\n     ')}`
        }`,
      );
      results.push(result);
    }
    for (const walk of spec.walks) {
      if (only && only !== 'walks') {
        break;
      }
      const result = {
        language,
        kind: 'walk',
        ...(await walkScreen(driver, walk, opts)),
      };
      console.log(
        `${result.ok ? 'PASS' : 'FAIL'} [${language}] walk ${walk.name}: ${
          result.items
        } items, ${result.edges} moves${
          result.ok ? '' : `\n     ${result.issues.join('\n     ')}`
        }`,
      );
      results.push(result);
    }
  }
  return results;
}
