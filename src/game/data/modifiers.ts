export type ModifierId =
  | "cursed"
  | "swarm"
  | "eliteHunt"
  | "bossBuff"
  | "glassCannon"
  | "ironclad"
  | "greed"
  | "hasteDepths";

export interface ModifierEffects {
  enemyHp: number;
  enemyDmg: number;
  enemySpeed: number;
  enemyCount: number;
  eliteChanceAdd: number;
  bossHp: number;
  bossDmg: number;
  playerDmg: number;
  playerMaxHp: number;
  xpGain: number;
  lootMul: number;
  cursedRooms: boolean;
  playerSpeed: number;
}

export interface RunModifier {
  id: ModifierId;
  name: string;
  desc: string;
  icon: string;
  /** score multiplier contribution (added over 1.0) */
  score: number;
  effects: Partial<ModifierEffects>;
}

export const MODIFIERS: RunModifier[] = [
  {
    id: "cursed", name: "CURSED ROOMS", icon: "skull", score: 0.25,
    desc: "Every 3rd room is cursed: +30% enemy HP & damage, but double loot.",
    effects: { cursedRooms: true },
  },
  {
    id: "swarm", name: "SWARM", icon: "skull", score: 0.3,
    desc: "+60% enemies per room, but they have 20% less health.",
    effects: { enemyCount: 1.6, enemyHp: 0.8 },
  },
  {
    id: "eliteHunt", name: "ELITE HUNT", icon: "star", score: 0.25,
    desc: "Elites appear far more often and drop richer loot.",
    effects: { eliteChanceAdd: 0.22, lootMul: 1.3 },
  },
  {
    id: "bossBuff", name: "EMPOWERED BOSSES", icon: "shield", score: 0.35,
    desc: "Bosses gain +60% health and +30% damage.",
    effects: { bossHp: 1.6, bossDmg: 1.3 },
  },
  {
    id: "glassCannon", name: "GLASS CANNON", icon: "sword", score: 0.4,
    desc: "You deal +70% damage but have half maximum health.",
    effects: { playerDmg: 1.7, playerMaxHp: 0.5 },
  },
  {
    id: "ironclad", name: "IRONCLAD FOES", icon: "shield", score: 0.3,
    desc: "Enemies gain +35% health and +15% damage.",
    effects: { enemyHp: 1.35, enemyDmg: 1.15 },
  },
  {
    id: "greed", name: "GREED PACT", icon: "coin", score: 0.2,
    desc: "+50% XP and loot, but enemies hit 20% harder.",
    effects: { xpGain: 1.5, lootMul: 1.5, enemyDmg: 1.2 },
  },
  {
    id: "hasteDepths", name: "HASTE OF THE DEPTHS", icon: "boot", score: 0.3,
    desc: "Everything moves faster — enemies +25%, you +12%.",
    effects: { enemySpeed: 1.25, playerSpeed: 1.12 },
  },
];

export const DEFAULT_EFFECTS: ModifierEffects = {
  enemyHp: 1, enemyDmg: 1, enemySpeed: 1, enemyCount: 1, eliteChanceAdd: 0,
  bossHp: 1, bossDmg: 1, playerDmg: 1, playerMaxHp: 1, xpGain: 1, lootMul: 1,
  cursedRooms: false, playerSpeed: 1,
};

export function resolveModifiers(ids: ModifierId[]): ModifierEffects & { scoreMul: number } {
  const out: ModifierEffects & { scoreMul: number } = { ...DEFAULT_EFFECTS, scoreMul: 1 };
  for (const id of ids) {
    const m = MODIFIERS.find((x) => x.id === id);
    if (!m) continue;
    out.scoreMul += m.score;
    const e = m.effects;
    out.enemyHp *= e.enemyHp ?? 1;
    out.enemyDmg *= e.enemyDmg ?? 1;
    out.enemySpeed *= e.enemySpeed ?? 1;
    out.enemyCount *= e.enemyCount ?? 1;
    out.eliteChanceAdd += e.eliteChanceAdd ?? 0;
    out.bossHp *= e.bossHp ?? 1;
    out.bossDmg *= e.bossDmg ?? 1;
    out.playerDmg *= e.playerDmg ?? 1;
    out.playerMaxHp *= e.playerMaxHp ?? 1;
    out.xpGain *= e.xpGain ?? 1;
    out.lootMul *= e.lootMul ?? 1;
    out.playerSpeed *= e.playerSpeed ?? 1;
    if (e.cursedRooms) out.cursedRooms = true;
  }
  return out;
}
