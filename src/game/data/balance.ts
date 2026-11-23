// Central tuning file for THE GILDED DEPTHS
export const TILE = 32;

export const PALETTE = {
  bg: "#282223",
  outline: "#171719",
  wood1: "#56392D",
  wood2: "#704A36",
  wood3: "#8A6047",
  metal1: "#B49A50",
  metal2: "#D0B75F",
  metal3: "#E0C875",
  crate1: "#BDA98B",
  crate2: "#D2BE9B",
  green: "#48D66D",
  red: "#D94A4A",
  blue: "#4C9BE8",
  gold: "#F0C94A",
  white: "#F2ECE2",
};

export const PLAYER_BASE = {
  maxHealth: 100,
  damage: 15,
  attackSpeed: 4, // shots / second
  critChance: 0.08,
  critDamage: 1.75,
  moveSpeed: 180,
  projectileSpeed: 500,
  projectileSize: 4,
  dashDistance: 150,
  dashDuration: 0.16,
  dashCooldown: 1.5,
  armor: 0,
  radius: 10,
  pickupRange: 92,
  xpGain: 1,
  invulnTime: 0.7,
};

export const XP_BASE = 100;
export const XP_GROWTH = 1.45;
export function xpForLevel(level: number): number {
  return Math.round(XP_BASE * Math.pow(XP_GROWTH, level - 1) / 5) * 5;
}

export const LEVEL_UP_GAINS = {
  maxHealth: 6,
  damage: 1.2,
  healOnLevel: 15,
};

export type EnemyKind =
  | "melee" | "fast" | "ranged" | "tank" | "elite"
  | "shielded" | "bomber" | "sniper";

export interface EnemyBase {
  kind: EnemyKind;
  name: string;
  health: number;
  damage: number;
  speed: number;
  radius: number;
  attackRate: number; // attacks / sec
  attackRange: number;
  projectileSpeed: number;
  xp: number;
  coinChance: number;
  knockbackResist: number;
  color: string;
  accent: string;
  size: number; // sprite draw size
}

export const ENEMIES: Record<EnemyKind, EnemyBase> = {
  melee: {
    kind: "melee", name: "Husk", health: 42, damage: 9, speed: 72, radius: 11,
    attackRate: 1.1, attackRange: 26, projectileSpeed: 0, xp: 22, coinChance: 0.4,
    knockbackResist: 0.2, color: "#D94A4A", accent: "#F2ECE2", size: 26,
  },
  fast: {
    kind: "fast", name: "Skitter", health: 24, damage: 6, speed: 132, radius: 9,
    attackRate: 1.6, attackRange: 22, projectileSpeed: 0, xp: 18, coinChance: 0.3,
    knockbackResist: 0, color: "#E07A3A", accent: "#F0C94A", size: 22,
  },
  ranged: {
    kind: "ranged", name: "Caster", health: 30, damage: 8, speed: 62, radius: 10,
    attackRate: 0.75, attackRange: 250, projectileSpeed: 190, xp: 26, coinChance: 0.5,
    knockbackResist: 0.1, color: "#4C9BE8", accent: "#9BD2FF", size: 25,
  },
  tank: {
    kind: "tank", name: "Bulwark", health: 130, damage: 16, speed: 44, radius: 16,
    attackRate: 0.6, attackRange: 34, projectileSpeed: 0, xp: 48, coinChance: 0.8,
    knockbackResist: 0.85, color: "#8A6047", accent: "#D0B75F", size: 38,
  },
  elite: {
    kind: "elite", name: "Gilded Elite", health: 95, damage: 14, speed: 96, radius: 13,
    attackRate: 1.2, attackRange: 210, projectileSpeed: 240, xp: 70, coinChance: 1,
    knockbackResist: 0.5, color: "#D0B75F", accent: "#48D66D", size: 32,
  },
  shielded: {
    kind: "shielded", name: "Aegis", health: 70, damage: 12, speed: 66, radius: 13,
    attackRate: 0.9, attackRange: 30, projectileSpeed: 0, xp: 40, coinChance: 0.6,
    knockbackResist: 0.75, color: "#5C7C9B", accent: "#D0B75F", size: 30,
  },
  bomber: {
    kind: "bomber", name: "Powderkeg", health: 28, damage: 26, speed: 118, radius: 11,
    attackRate: 1, attackRange: 44, projectileSpeed: 0, xp: 34, coinChance: 0.5,
    knockbackResist: 0, color: "#B4562F", accent: "#F0C94A", size: 24,
  },
  sniper: {
    kind: "sniper", name: "Longeye", health: 26, damage: 18, speed: 54, radius: 10,
    attackRate: 0.45, attackRange: 430, projectileSpeed: 420, xp: 44, coinChance: 0.6,
    knockbackResist: 0, color: "#8E5CB8", accent: "#E7D2FF", size: 26,
  },
};

/** Shield pool for Aegis foes, scaled off their health. */
export const SHIELD_RATIO = 0.6;

export const BOSS_BASE = {
  health: 900,
  damage: 22,
  speed: 58,
  radius: 30,
  projectileSpeed: 220,
  xp: 400,
  size: 76,
};

export type Difficulty = "EASY" | "NORMAL" | "HARD";
export const DIFFICULTY: Record<Difficulty, { hp: number; dmg: number; count: number }> = {
  EASY: { hp: 0.8, dmg: 0.8, count: 0.85 },
  NORMAL: { hp: 1, dmg: 1, count: 1 },
  HARD: { hp: 1.25, dmg: 1.25, count: 1.2 },
};

export const FINAL_ROOM = 15;
export const BOSS_EVERY = 5;

export function enemyCountForRoom(room: number): number {
  return Math.min(24, 4 + Math.round(room * 2.2));
}

export function eliteChance(playerLevel: number): number {
  if (playerLevel < 3) return 0;
  return Math.min(0.32, (playerLevel - 2) * 0.035);
}
