import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layoutGraph, stepSprings, type LayoutPoint } from './graphLayout';

const nodes = ['topic:a', 'topic:b', 'n1', 'n2', 'n3', 'n4', 'n5'].map((id) => ({ id }));
const links = [
  { source: 'n1', target: 'topic:a' },
  { source: 'n2', target: 'topic:a' },
  { source: 'n3', target: 'topic:b' },
  { source: 'n4', target: 'topic:b' },
];

test('graph layout is deterministic and keeps every node on the canvas', () => {
  const first = layoutGraph(nodes, links, 900, 420);
  assert.deepEqual(layoutGraph(nodes, links, 900, 420), first);
  for (const node of nodes) {
    const point = first[node.id];
    assert.ok(point.x >= 0 && point.x <= 900, `${node.id} x in bounds`);
    assert.ok(point.y >= 0 && point.y <= 420, `${node.id} y in bounds`);
  }
});

test('graph layout pulls linked notes closer to their topic than to another topic', () => {
  const points = layoutGraph(nodes, links, 900, 420);
  const distance = (a: string, b: string) => Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);
  assert.ok(distance('n1', 'topic:a') < distance('n1', 'topic:b'));
  assert.ok(distance('n3', 'topic:b') < distance('n3', 'topic:a'));
});

test('graph layout ignores links to unknown nodes and handles an empty graph', () => {
  assert.deepEqual(layoutGraph([], links, 900, 420), {});
  assert.equal(Object.keys(layoutGraph([{ id: 'only' }], links, 900, 420)).length, 1);
});

test('dragging a node pulls its linked neighbours, and release settles everything back to rest', () => {
  const rest = layoutGraph(nodes, links, 900, 420);
  const points: Record<string, LayoutPoint> = Object.fromEntries(Object.entries(rest).map(([id, point]) => [id, { ...point }]));
  const velocities: Record<string, LayoutPoint> = {};

  points['topic:a'] = { x: rest['topic:a'].x + 120, y: rest['topic:a'].y };
  for (let frame = 0; frame < 40; frame += 1) stepSprings(points, velocities, rest, links, 'topic:a');
  assert.equal(points['topic:a'].x, rest['topic:a'].x + 120);
  assert.ok(points.n1.x - rest.n1.x > 40, 'a linked note follows the dragged topic');
  assert.ok(Math.abs(points.n3.x - rest.n3.x) < 1, 'an unlinked note stays put');

  let unrest = Infinity;
  for (let frame = 0; frame < 400; frame += 1) unrest = stepSprings(points, velocities, rest, links, null);
  assert.ok(unrest < 0.01, `settled, got ${unrest}`);
});
