import { PALETTE } from "./balance";

export type WeaponId = "pistol" | "shotgun" | "smg" | "railgun" | "arcorb";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  desc: string;
  icon: string;
  unlockLevel: number;
  /** multiplier applied to the player's attackSpeed stat */
  rate: number;
  /** damage multiplier per projectile */
  damage: number;
  pellets: number;
  /** total cone in radians */
  spread: number;
  /** extra enemies a bullet can pass through */
  pierce: number;
  /** wall bounces before dying */
  bounce: number;
  projSpeed: number;
  size: number;
  color: string;
  knockback: number;
  shake: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: "pistol", name: "IRON REPEATER", desc: "Balanced single shot", icon: "bolt",
    unlockLevel: 1, rate: 1, damage: 1, pellets: 1, spread: 0.02, pierce: 0, bounce: 0,
    projSpeed: 1, size: 4, color: PALETTE.green, knockback: 220, shake: 1.5,
  },
  shotgun: {
    id: "shotgun", name: "FOUNDRY SCATTER", desc: "5 pellets, brutal up close", icon: "sword",
    unlockLevel: 2, rate: 0.42, damage: 0.5, pellets: 5, spread: 0.42, pierce: 0, bounce: 0,
    projSpeed: 0.85, size: 3, color: PALETTE.crate2, knockback: 320, shake: 5,
  },
  smg: {
    id: "smg", name: "CLOCKWORK SPITTER", desc: "Very fast, low damage", icon: "boot",
    unlockLevel: 3, rate: 2.2, damage: 0.4, pellets: 1, spread: 0.16, pierce: 0, bounce: 0,
    projSpeed: 1.1, size: 3, color: PALETTE.blue, knockback: 90, shake: 0.8,
  },
  railgun: {
    id: "railgun", name: "GILDED LANCE", desc: "Slow, piercing, huge hits", icon: "star",
    unlockLevel: 5, rate: 0.32, damage: 2.8, pellets: 1, spread: 0, pierce: 4, bounce: 0,
    projSpeed: 2.4, size: 5, color: PALETTE.gold, knockback: 260, shake: 6,
  },
  arcorb: {
    id: "arcorb", name: "ARC ORB", desc: "Bouncing orbs that ricochet", icon: "shield",
    unlockLevel: 7, rate: 0.75, damage: 1.2, pellets: 1, spread: 0.06, pierce: 1, bounce: 4,
    projSpeed: 0.65, size: 6, color: PALETTE.metal3, knockback: 180, shake: 2,
  },
};

export const WEAPON_ORDER: WeaponId[] = ["pistol", "shotgun", "smg", "railgun", "arcorb"];

export interface WeaponMod {
  damage: number;
  rate: number;
  pellets: number;
  pierce: number;
  tier: number;
}

export function freshMods(): Record<WeaponId, WeaponMod> {
  const out = {} as Record<WeaponId, WeaponMod>;
  for (const id of WEAPON_ORDER) out[id] = { damage: 1, rate: 1, pellets: 0, pierce: 0, tier: 0 };
  return out;
}

export const MAX_WEAPON_TIER = 3;

/** The unlockable upgrade path for each weapon, one entry per tier. */
export const WEAPON_PATHS: Record<WeaponId, { title: string; desc: string; apply: (m: WeaponMod) => void }[]> = {
  pistol: [
    { title: "REPEATER I", desc: "+25% pistol damage", apply: (m) => { m.damage *= 1.25; } },
    { title: "REPEATER II", desc: "+30% pistol fire rate", apply: (m) => { m.rate *= 1.3; } },
    { title: "REPEATER III", desc: "Pistol shots pierce 2", apply: (m) => { m.pierce += 2; } },
  ],
  shotgun: [
    { title: "SCATTER I", desc: "+2 shotgun pellets", apply: (m) => { m.pellets += 2; } },
    { title: "SCATTER II", desc: "+30% shotgun damage", apply: (m) => { m.damage *= 1.3; } },
    { title: "SCATTER III", desc: "+40% shotgun fire rate", apply: (m) => { m.rate *= 1.4; } },
  ],
  smg: [
    { title: "SPITTER I", desc: "+35% SMG fire rate", apply: (m) => { m.rate *= 1.35; } },
    { title: "SPITTER II", desc: "+35% SMG damage", apply: (m) => { m.damage *= 1.35; } },
    { title: "SPITTER III", desc: "SMG fires twin rounds", apply: (m) => { m.pellets += 1; } },
  ],
  railgun: [
    { title: "LANCE I", desc: "+2 lance pierce", apply: (m) => { m.pierce += 2; } },
    { title: "LANCE II", desc: "+35% lance damage", apply: (m) => { m.damage *= 1.35; } },
    { title: "LANCE III", desc: "+45% lance fire rate", apply: (m) => { m.rate *= 1.45; } },
  ],
  arcorb: [
    { title: "ARC I", desc: "+1 orb, wider arc", apply: (m) => { m.pellets += 1; } },
    { title: "ARC II", desc: "+35% orb damage", apply: (m) => { m.damage *= 1.35; } },
    { title: "ARC III", desc: "+3 orb pierce", apply: (m) => { m.pierce += 3; } },
  ],
};

export function weaponUnlocksAtLevel(level: number): WeaponId[] {
  return WEAPON_ORDER.filter((id) => WEAPONS[id].unlockLevel === level);
}
