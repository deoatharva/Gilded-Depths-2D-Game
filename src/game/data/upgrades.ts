import { MAX_WEAPON_TIER, WEAPONS, WEAPON_PATHS, type WeaponId, type WeaponMod } from "./weapons";

export interface Upgrade {
  id: string;
  title: string;
  desc: string;
  icon: string;
  /** set for weapon-path cards */
  weapon?: WeaponId;
  apply: (s: PlayerStats) => void;
  applyWeapon?: (m: WeaponMod) => void;
}

export interface PlayerStats {
  maxHealth: number;
  damage: number;
  attackSpeed: number;
  critChance: number;
  critDamage: number;
  moveSpeed: number;
  projectileSpeed: number;
  dashCooldown: number;
  armor: number;
  xpGain: number;
  pickupRange: number;
}

export const UPGRADES: Upgrade[] = [
  { id: "dmg", title: "+10% DAMAGE", desc: "Heavier rounds", icon: "sword", apply: (s) => { s.damage *= 1.1; } },
  { id: "spd", title: "+10% SPEED", desc: "Lighter boots", icon: "boot", apply: (s) => { s.moveSpeed *= 1.1; } },
  { id: "atk", title: "+10% FIRE RATE", desc: "Oiled mechanism", icon: "bolt", apply: (s) => { s.attackSpeed *= 1.1; } },
  { id: "hp", title: "+20 MAX HEALTH", desc: "Bronze plating", icon: "heart", apply: (s) => { s.maxHealth += 20; } },
  { id: "crit", title: "+5% CRIT CHANCE", desc: "Keen eye", icon: "star", apply: (s) => { s.critChance = Math.min(0.75, s.critChance + 0.05); } },
  { id: "critd", title: "+25% CRIT DAMAGE", desc: "Brutal aim", icon: "star", apply: (s) => { s.critDamage += 0.25; } },
  { id: "proj", title: "+10% BULLET SPEED", desc: "Tighter barrel", icon: "bolt", apply: (s) => { s.projectileSpeed *= 1.1; } },
  { id: "dash", title: "-10% DASH COOLDOWN", desc: "Quick step", icon: "boot", apply: (s) => { s.dashCooldown *= 0.9; } },
  { id: "xp", title: "+10% XP GAIN", desc: "Fast learner", icon: "star", apply: (s) => { s.xpGain *= 1.1; } },
  { id: "armor", title: "+2 ARMOR", desc: "Flat damage cut", icon: "shield", apply: (s) => { s.armor += 2; } },
  { id: "magnet", title: "+30% PICKUP RANGE", desc: "Loot magnet", icon: "star", apply: (s) => { s.pickupRange *= 1.3; } },
];

/** Builds the weapon-path cards available for the weapons the player owns. */
export function weaponUpgrades(unlocked: WeaponId[], mods: Record<WeaponId, WeaponMod>): Upgrade[] {
  const out: Upgrade[] = [];
  for (const id of unlocked) {
    const tier = mods[id].tier;
    if (tier >= MAX_WEAPON_TIER) continue;
    const path = WEAPON_PATHS[id][tier];
    if (!path) continue;
    out.push({
      id: `${id}-t${tier + 1}`,
      title: path.title,
      desc: `${WEAPONS[id].name}: ${path.desc}`,
      icon: WEAPONS[id].icon,
      weapon: id,
      apply: () => {},
      applyWeapon: path.apply,
    });
  }
  return out;
}

export function rollUpgrades(n = 3, weaponCards: Upgrade[] = []): Upgrade[] {
  // Weapon paths are weighted higher so builds progress along a chosen weapon.
  const pool = [...UPGRADES, ...weaponCards, ...weaponCards];
  const out: Upgrade[] = [];
  const seen = new Set<string>();
  while (out.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    const u = pool.splice(i, 1)[0]!;
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    out.push(u);
  }
  return out;
}
