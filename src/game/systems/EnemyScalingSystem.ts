import { DIFFICULTY, type Difficulty, type EnemyBase } from "../data/balance";

export interface ScaledStats {
  level: number;
  health: number;
  damage: number;
  speed: number;
  attackRate: number;
  projectileSpeed: number;
  xp: number;
  coinChance: number;
}

/**
 * The single source of truth for enemy strength.
 * Both playerLevel and roomLevel contribute; difficulty multiplies the result.
 */
export function getEnemyStats(
  base: Pick<EnemyBase, "health" | "damage" | "speed" | "attackRate" | "projectileSpeed" | "xp" | "coinChance">,
  playerLevel: number,
  roomLevel: number,
  difficulty: Difficulty,
): ScaledStats {
  const p = Math.max(0, playerLevel - 1);
  const r = Math.max(0, roomLevel - 1);
  const d = DIFFICULTY[difficulty];

  const healthMul = 1 + p * 0.2 + r * 0.1;
  const damageMul = 1 + p * 0.12 + r * 0.08;
  const speedMul = Math.min(1.7, 1 + p * 0.05 + r * 0.03);
  const rateMul = Math.min(1.8, 1 + p * 0.04 + r * 0.03);
  const projMul = Math.min(2, 1 + p * 0.07 + r * 0.04);
  const xpMul = 1 + p * 0.05 + r * 0.08;

  return {
    level: Math.max(playerLevel, roomLevel),
    health: Math.round(base.health * healthMul * d.hp),
    damage: Math.round(base.damage * damageMul * d.dmg * 10) / 10,
    speed: base.speed * speedMul,
    attackRate: base.attackRate * rateMul,
    projectileSpeed: base.projectileSpeed * projMul,
    xp: Math.round(base.xp * xpMul),
    coinChance: base.coinChance,
  };
}

export function scaledEnemyCount(count: number, difficulty: Difficulty): number {
  return Math.max(3, Math.round(count * DIFFICULTY[difficulty].count));
}
