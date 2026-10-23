export type Point = { x: number; y: number };
export type Handoff = { key: string; mission_id: string; agent_id: string; target_agent: string; timestamp: string };
export const DESK_POSITIONS: Record<string, Point> = { manager: { x: 235, y: 344 }, researcher: { x: 480, y: 344 }, writer: { x: 725, y: 344 } };
export const BREAK_SPOTS: Point[] = [{ x: 392, y: 400 }, { x: 560, y: 400 }, { x: 816, y: 392 }];
const furniture = [
  { x: 154, y: 205, w: 162, h: 105 }, { x: 399, y: 205, w: 162, h: 105 }, { x: 644, y: 205, w: 162, h: 105 },
  { x: 72, y: 338, w: 49, h: 127 }, { x: 192, y: 427, w: 178, h: 64 },
  { x: 412, y: 436, w: 114, h: 42 }, { x: 600, y: 421, w: 168, h: 59 },
  { x: 74, y: 133, w: 52, h: 52 }, { x: 838, y: 133, w: 52, h: 52 }, { x: 842, y: 437, w: 44, h: 40 },
];
export function walkable(point: Point) {
  return point.x >= 64 && point.x <= 896 && point.y >= 144 && point.y <= 496 && !furniture.some(box => point.x > box.x - 12 && point.x < box.x + box.w + 12 && point.y > box.y - 12 && point.y < box.y + box.h + 12);
}

/** Cardinal A* on a 16px grid; furniture includes a small personal-space margin. */
export function findOfficePath(start: Point, goal: Point): Point[] {
  if (!walkable(start) || !walkable(goal)) return [];
  const cell = (point: Point) => ({ x: Math.floor(point.x / 16), y: Math.floor(point.y / 16) });
  const world = (x: number, y: number) => ({ x: x * 16 + 8, y: y * 16 + 8 });
  const key = (x: number, y: number) => y * 60 + x;
  const from = cell(start); const to = cell(goal);
  if (!walkable(world(from.x, from.y)) || !walkable(world(to.x, to.y))) return [];
  const heuristic = (x: number, y: number) => Math.abs(to.x - x) + Math.abs(to.y - y);
  const open = [{ ...from, g: 0, f: heuristic(from.x, from.y) }];
  const best = new Map<number, number>([[key(from.x, from.y), 0]]);
  const parents = new Map<number, number>(); const visited = new Set<number>();
  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const node = open.shift()!; const id = key(node.x, node.y);
    if (visited.has(id)) continue;
    if (node.x === to.x && node.y === to.y) {
      const points = [world(node.x, node.y)]; let cursor = id;
      while (parents.has(cursor)) { cursor = parents.get(cursor)!; points.push(world(cursor % 60, Math.floor(cursor / 60))); }
      return [start, ...points.reverse(), goal];
    }
    visited.add(id);
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const x = node.x + dx; const y = node.y + dy; const next = key(x, y); const g = node.g + 1;
      if (x < 4 || x > 55 || y < 9 || y > 30 || visited.has(next) || !walkable(world(x, y)) || g >= (best.get(next) ?? Infinity)) continue;
      best.set(next, g); parents.set(next, id); open.push({ x, y, g, f: g + heuristic(x, y) });
    }
  }
  return [];
}

export function stepPath(position: Point, path: Point[], index: number, distance: number) {
  let point = { ...position }; let remaining = Math.max(0, distance);
  while (index < path.length) {
    const target = path[index]; const length = Math.hypot(target.x - point.x, target.y - point.y);
    if (length <= remaining) { remaining -= length; point = { ...target }; index++; }
    else { if (length > 0) point = { x: point.x + (target.x - point.x) / length * remaining, y: point.y + (target.y - point.y) / length * remaining }; break; }
  }
  return { point, index, done: index >= path.length };
}

/** Polling can repeat events. Opening the office seeds history without replaying it. */
export class HandoffInbox {
  private seeded = false;
  private seen = new Set<string>();
  ingest(events: Handoff[], ready: boolean, now = Date.now()): Handoff[] {
    if (!ready) return [];
    const fresh = events.filter(event => !this.seen.has(event.key) && now - Date.parse(event.timestamp) >= -5000 && now - Date.parse(event.timestamp) < 30000);
    events.forEach(event => this.seen.add(event.key));
    if (this.seen.size > 2000) this.seen = new Set([...this.seen].slice(-1000));
    if (!this.seeded) { this.seeded = true; return []; }
    return fresh;
  }
}
