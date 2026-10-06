export type LayoutNode = { id: string };
export type LayoutLink = { source: string; target: string };
export type LayoutPoint = { x: number; y: number };

const ITERATIONS = 320;
const REPULSION = 2400;
const LINK_LENGTH = 38;
const LINK_STRENGTH = 0.14;
const GRAVITY = 0.014;
const DAMPING = 0.6;
const MAX_SPEED = 24;
const MAX_FIT_SCALE = 1.8;
/** Room for labels: they sit under each node and extend sideways. */
const PAD = { x: 56, top: 28, bottom: 44 };

/**
 * Force-directed layout: every node repels every other, links pull their ends
 * together, and a weak gravity keeps loose nodes in view. It is deterministic
 * (no randomness), so the same notes always settle into the same picture.
 */
export function layoutGraph(
  nodes: LayoutNode[],
  links: LayoutLink[],
  width: number,
  height: number,
): Record<string, LayoutPoint> {
  const count = nodes.length;
  if (count === 0) return {};
  const index = new Map(nodes.map((node, i) => [node.id, i]));
  const pairs = links.flatMap((link) => {
    const a = index.get(link.source);
    const b = index.get(link.target);
    return a === undefined || b === undefined || a === b ? [] : [[a, b] as const];
  });

  // Seed on a golden-angle spiral so nothing starts stacked on anything else.
  const seedX = nodes.map((_, i) => Math.cos(i * 2.39996) * 60 * Math.sqrt(i + 1));
  const seedY = nodes.map((_, i) => Math.sin(i * 2.39996) * 60 * Math.sqrt(i + 1));
  // Then start each node beside its better-connected neighbours, so clusters begin
  // untangled instead of having to pull through each other.
  const neighbours = nodes.map(() => [] as number[]);
  for (const [a, b] of pairs) {
    neighbours[a].push(b);
    neighbours[b].push(a);
  }
  const anchorsOf = (i: number) => neighbours[i].filter((j) => (
    neighbours[j].length > neighbours[i].length || (neighbours[j].length === neighbours[i].length && j < i)
  ));
  const seed = (values: number[], i: number, nudge: number) => {
    const anchors = anchorsOf(i);
    if (anchors.length === 0) return values[i];
    return anchors.reduce((sum, j) => sum + values[j], 0) / anchors.length + nudge;
  };
  const x = nodes.map((_, i) => seed(seedX, i, Math.cos(i * 2.39996) * 12));
  const y = nodes.map((_, i) => seed(seedY, i, Math.sin(i * 2.39996) * 12));
  const vx = new Array<number>(count).fill(0);
  const vy = new Array<number>(count).fill(0);
  // Pull harder on the short axis so the graph spreads to the canvas's shape.
  const aspect = width / Math.max(1, height);
  const gravityX = GRAVITY / Math.max(1, aspect);
  const gravityY = GRAVITY / Math.max(1, 1 / aspect);

  for (let step = 0; step < ITERATIONS; step += 1) {
    const alpha = 1 - step / ITERATIONS;
    const fx = x.map((value) => -value * gravityX);
    const fy = y.map((value) => -value * gravityY);
    for (let a = 0; a < count; a += 1) {
      for (let b = a + 1; b < count; b += 1) {
        const dx = x[a] - x[b];
        const dy = y[a] - y[b];
        const distSq = dx * dx + dy * dy + 0.01;
        const dist = Math.sqrt(distSq);
        const force = REPULSION / distSq;
        fx[a] += (dx / dist) * force;
        fy[a] += (dy / dist) * force;
        fx[b] -= (dx / dist) * force;
        fy[b] -= (dy / dist) * force;
      }
    }
    for (const [a, b] of pairs) {
      const dx = x[b] - x[a];
      const dy = y[b] - y[a];
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const force = (dist - LINK_LENGTH) * LINK_STRENGTH;
      fx[a] += (dx / dist) * force;
      fy[a] += (dy / dist) * force;
      fx[b] -= (dx / dist) * force;
      fy[b] -= (dy / dist) * force;
    }
    for (let i = 0; i < count; i += 1) {
      vx[i] = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, (vx[i] + fx[i]) * DAMPING));
      vy[i] = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, (vy[i] + fy[i]) * DAMPING));
      x[i] += vx[i] * alpha;
      y[i] += vy[i] * alpha;
    }
  }

  // Scale the settled graph to fit the canvas and centre it.
  const minX = Math.min(...x);
  const maxX = Math.max(...x);
  const minY = Math.min(...y);
  const maxY = Math.max(...y);
  const innerWidth = Math.max(1, width - PAD.x * 2);
  const innerHeight = Math.max(1, height - PAD.top - PAD.bottom);
  const scale = Math.min(
    MAX_FIT_SCALE,
    innerWidth / Math.max(1, maxX - minX),
    innerHeight / Math.max(1, maxY - minY),
  );
  const offsetX = PAD.x + innerWidth / 2 - ((minX + maxX) / 2) * scale;
  const offsetY = PAD.top + innerHeight / 2 - ((minY + maxY) / 2) * scale;
  return Object.fromEntries(nodes.map((node, i) => [node.id, { x: x[i] * scale + offsetX, y: y[i] * scale + offsetY }]));
}

const ANCHOR_PULL = 0.045;
const LINK_PULL = 0.07;
const SPRING_DAMPING = 0.8;
/** Keeps a heavily linked node's combined pull inside the range where the springs stay stable. */
const MAX_LINK_PULLS = 10;

/**
 * One frame of the elastic motion used while a node is dragged. Each node is
 * sprung to its resting place and to its linked neighbours, so neighbours trail
 * a dragged node and everything eases back with a slight overshoot on release.
 * Mutates `points` and `velocities`; returns how far the graph is from rest.
 */
export function stepSprings(
  points: Record<string, LayoutPoint>,
  velocities: Record<string, LayoutPoint>,
  rest: Record<string, LayoutPoint>,
  links: LayoutLink[],
  pinnedId: string | null,
): number {
  const forces: Record<string, LayoutPoint> = {};
  const degree: Record<string, number> = {};
  for (const id of Object.keys(points)) {
    forces[id] = { x: (rest[id].x - points[id].x) * ANCHOR_PULL, y: (rest[id].y - points[id].y) * ANCHOR_PULL };
    degree[id] = 0;
  }
  const linked = links.filter((link) => points[link.source] && points[link.target] && link.source !== link.target);
  for (const link of linked) {
    degree[link.source] += 1;
    degree[link.target] += 1;
  }
  const pull = (id: string, other: string) => {
    // Where this node would sit if it kept its resting offset from the other one.
    const strength = LINK_PULL * Math.min(1, MAX_LINK_PULLS / degree[id]);
    forces[id].x += (points[other].x + rest[id].x - rest[other].x - points[id].x) * strength;
    forces[id].y += (points[other].y + rest[id].y - rest[other].y - points[id].y) * strength;
  };
  for (const link of linked) {
    pull(link.source, link.target);
    pull(link.target, link.source);
  }
  let unrest = 0;
  for (const id of Object.keys(points)) {
    if (id === pinnedId) {
      velocities[id] = { x: 0, y: 0 };
      continue;
    }
    const velocity = velocities[id] ?? { x: 0, y: 0 };
    velocity.x = (velocity.x + forces[id].x) * SPRING_DAMPING;
    velocity.y = (velocity.y + forces[id].y) * SPRING_DAMPING;
    velocities[id] = velocity;
    points[id].x += velocity.x;
    points[id].y += velocity.y;
    unrest = Math.max(
      unrest,
      Math.abs(velocity.x),
      Math.abs(velocity.y),
      Math.abs(points[id].x - rest[id].x),
      Math.abs(points[id].y - rest[id].y),
    );
  }
  return unrest;
}
