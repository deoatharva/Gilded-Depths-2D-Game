import { BOSS_EVERY } from "./balance";

export const ROOM_W = 34;
export const ROOM_H = 22;

// 0 floor, 1 wall, 2 destructible crate, 3 solid pillar/barrel
export type TileMap = number[][];

export type RoomKind = "open" | "maze" | "central" | "corridors" | "arena" | "boss";

function blank(w = ROOM_W, h = ROOM_H): TileMap {
  const m: TileMap = [];
  for (let y = 0; y < h; y++) {
    const row: number[] = [];
    for (let x = 0; x < w; x++) {
      row.push(x === 0 || y === 0 || x === w - 1 || y === h - 1 ? 1 : 0);
    }
    m.push(row);
  }
  return m;
}

function rect(m: TileMap, x0: number, y0: number, w: number, h: number, v: number) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++)
      if (m[y] && m[y]![x] !== undefined) m[y]![x] = v;
}

function rand(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function buildRoom(roomNumber: number): { map: TileMap; kind: RoomKind } {
  const isBoss = roomNumber % BOSS_EVERY === 0;
  const m = blank();
  const rng = rand(roomNumber * 7919 + 13);
  if (isBoss) {
    // Boss arena: open with 4 corner pillars
    rect(m, 4, 4, 2, 2, 3);
    rect(m, ROOM_W - 6, 4, 2, 2, 3);
    rect(m, 4, ROOM_H - 6, 2, 2, 3);
    rect(m, ROOM_W - 6, ROOM_H - 6, 2, 2, 3);
    return { map: m, kind: "boss" };
  }
  const kinds: RoomKind[] = ["open", "maze", "central", "corridors", "arena"];
  const kind = kinds[(roomNumber - 1) % kinds.length]!;

  if (kind === "open") {
    for (let i = 0; i < 10; i++) {
      const x = 3 + Math.floor(rng() * (ROOM_W - 7));
      const y = 3 + Math.floor(rng() * (ROOM_H - 7));
      rect(m, x, y, 1 + Math.floor(rng() * 2), 1, rng() < 0.7 ? 2 : 3);
    }
  } else if (kind === "maze") {
    for (let gy = 3; gy < ROOM_H - 3; gy += 3) {
      for (let gx = 3; gx < ROOM_W - 3; gx += 4) {
        if (rng() < 0.75) rect(m, gx, gy, 2, 2, rng() < 0.65 ? 2 : 3);
      }
    }
  } else if (kind === "central") {
    rect(m, ROOM_W / 2 - 4, ROOM_H / 2 - 3, 8, 6, 1);
    rect(m, ROOM_W / 2 - 3, ROOM_H / 2 - 2, 6, 4, 0);
    rect(m, ROOM_W / 2 - 1, ROOM_H / 2 - 3, 2, 1, 0);
    for (let i = 0; i < 8; i++) {
      const x = 2 + Math.floor(rng() * (ROOM_W - 5));
      const y = 2 + Math.floor(rng() * (ROOM_H - 5));
      if (m[y]![x] === 0) m[y]![x] = 2;
    }
  } else if (kind === "corridors") {
    rect(m, 8, 2, 2, ROOM_H - 8, 1);
    rect(m, 17, 6, 2, ROOM_H - 8, 1);
    rect(m, 26, 2, 2, ROOM_H - 8, 1);
    for (let i = 0; i < 12; i++) {
      const x = 2 + Math.floor(rng() * (ROOM_W - 5));
      const y = 2 + Math.floor(rng() * (ROOM_H - 5));
      if (m[y]![x] === 0) m[y]![x] = rng() < 0.7 ? 2 : 3;
    }
  } else {
    rect(m, 6, 5, 3, 1, 3);
    rect(m, ROOM_W - 9, 5, 3, 1, 3);
    rect(m, 6, ROOM_H - 6, 3, 1, 3);
    rect(m, ROOM_W - 9, ROOM_H - 6, 3, 1, 3);
    for (let i = 0; i < 6; i++) {
      const x = 3 + Math.floor(rng() * (ROOM_W - 7));
      const y = 3 + Math.floor(rng() * (ROOM_H - 7));
      if (m[y]![x] === 0) m[y]![x] = 2;
    }
  }
  // Guarantee spawn area around player start (left side) is clear
  rect(m, 2, ROOM_H / 2 - 2, 4, 4, 0);
  return { map: m, kind };
}
