import {
  BOSS_BASE, ENEMIES, FINAL_ROOM, LEVEL_UP_GAINS, PALETTE, PLAYER_BASE, SHIELD_RATIO, TILE,
  eliteChance, enemyCountForRoom, xpForLevel, type EnemyKind,
} from "../data/balance";
import { ROOM_H, ROOM_W, buildRoom, type RoomKind, type TileMap } from "../data/rooms";
import { getEnemyStats, scaledEnemyCount } from "../systems/EnemyScalingSystem";
import { playSound, setMuted, setMusicVolume, setSfxVolume, startMusic, stopMusic } from "../systems/Audio";
import type { PlayerStats, Upgrade } from "../data/upgrades";
import { rollUpgrades, weaponUpgrades } from "../data/upgrades";
import {
  MAX_WEAPON_TIER, WEAPONS, WEAPON_ORDER, freshMods, weaponUnlocksAtLevel,
  type WeaponId, type WeaponMod,
} from "../data/weapons";
import { resolveModifiers, type ModifierId } from "../data/modifiers";
import { Pool } from "../systems/Pool";
import type { Settings } from "../systems/SaveSystem";

export type GameState = "playing" | "paused" | "levelup" | "gameover" | "victory";

export interface HudWeapon {
  id: WeaponId; name: string; tier: number; unlocked: boolean; slot: number; active: boolean;
}

export interface HudData {
  hp: number; maxHp: number;
  level: number; xp: number; xpNeeded: number;
  coins: number; kills: number; killsTarget: number;
  room: number; roomKind: RoomKind;
  dashReady: boolean; dashPct: number;
  bossHp: number; bossMaxHp: number; bossName: string; bossPhase: number;
  roomCleared: boolean;
  buffs: { id: string; time: number }[];
  score: number;
  stats: PlayerStats;
  weapons: HudWeapon[];
  cursedRoom: boolean;
  modifiers: ModifierId[];
  scoreMul: number;
  fps: number;
}

export interface RunResult {
  score: number; level: number; rooms: number; kills: number; coins: number;
  bosses: number; damage: number; time: number;
}

interface Vec { x: number; y: number }

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; }
interface FloatText { x: number; y: number; vy: number; life: number; text: string; color: string; size: number; }
interface Afterimage { x: number; y: number; life: number; angle: number; }

interface Projectile {
  x: number; y: number; vx: number; vy: number; dmg: number; life: number;
  size: number; color: string; crit: boolean; friendly: boolean;
  pierce: number; bounce: number; knockback: number; trail: boolean;
  /** ids of enemies already hit (pierce de-duplication) */
  hits: number[];
}

function newProjectile(): Projectile {
  return {
    x: 0, y: 0, vx: 0, vy: 0, dmg: 0, life: 0, size: 4, color: "#fff",
    crit: false, friendly: true, pierce: 0, bounce: 0, knockback: 220, trail: false, hits: [],
  };
}

function newParticle(): Particle {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: "#fff" };
}

interface Pickup {
  x: number; y: number; vx: number; vy: number; life: number;
  kind: "xp" | "coin" | "health" | "power";
  value: number; power?: PowerKind;
}

type PowerKind = "damage" | "speed" | "rapid" | "shield" | "magnet";

interface Enemy {
  id: number;
  kind: EnemyKind; name: string;
  x: number; y: number; vx: number; vy: number;
  hp: number; maxHp: number; dmg: number; speed: number;
  attackRate: number; attackRange: number; projSpeed: number;
  radius: number; size: number; color: string; accent: string;
  xp: number; coinChance: number; knockbackResist: number;
  level: number; elite: boolean;
  cooldown: number; flash: number; state: "idle" | "chase" | "attack" | "retreat" | "hurt";
  hurtTime: number; wobble: number; telegraph: number;
  /** direction the enemy is facing (shield plate faces this way) */
  facing: number;
  /** remaining shield pool for shielded foes (0 = broken) */
  shieldHp: number; shieldMax: number;
  /** bomber fuse countdown once armed (-1 = not armed) */
  fuse: number;
  /** sniper charge-up progress in seconds */
  charge: number;
}

interface Boss {
  x: number; y: number; vx: number; vy: number;
  hp: number; maxHp: number; dmg: number; speed: number; radius: number;
  projSpeed: number; level: number; xp: number;
  phase: number; flash: number; timer: number; attack: string; attackTime: number;
  chargeDir: Vec; name: string;
  /** spiral fan angle + per-shot cooldown */
  spin: number; attackCd: number;
  /** sweeping beam angle and sweep direction */
  beamAng: number; beamDir: number;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private running = false;

  state: GameState = "playing";
  settings: Settings;

  // world
  private map: TileMap = [];
  private roomKind: RoomKind = "open";
  roomNumber = 1;
  private worldW = ROOM_W * TILE;
  private worldH = ROOM_H * TILE;
  private roomCleared = false;
  private exit: Vec = { x: 0, y: 0 };
  private doorAnim = 0;

  // entities
  private player = {
    x: 100, y: 100, vx: 0, vy: 0, hp: PLAYER_BASE.maxHealth,
    invuln: 0, dashTime: 0, dashCd: 0, dashDir: { x: 1, y: 0 },
    fireCd: 0, recoil: 0, flash: 0, angle: 0, shield: false, walk: 0,
  };
  private stats: PlayerStats = {
    maxHealth: PLAYER_BASE.maxHealth,
    damage: PLAYER_BASE.damage,
    attackSpeed: PLAYER_BASE.attackSpeed,
    critChance: PLAYER_BASE.critChance,
    critDamage: PLAYER_BASE.critDamage,
    moveSpeed: PLAYER_BASE.moveSpeed,
    projectileSpeed: PLAYER_BASE.projectileSpeed,
    dashCooldown: PLAYER_BASE.dashCooldown,
    armor: PLAYER_BASE.armor,
    xpGain: PLAYER_BASE.xpGain,
    pickupRange: PLAYER_BASE.pickupRange,
  };
  private buffs = new Map<PowerKind, number>();

  private enemies: Enemy[] = [];
  private boss: Boss | null = null;
  private pickups: Pickup[] = [];
  private texts: FloatText[] = [];
  private afterimages: Afterimage[] = [];
  private enemySeq = 1;

  // pooled hot entities — allocated once, never garbage collected mid-run
  private projPool = new Pool<Projectile>(900, newProjectile);
  private partPool = new Pool<Particle>(1400, newParticle);

  // weapons
  weapon: WeaponId = "pistol";
  unlockedWeapons: WeaponId[] = ["pistol"];
  weaponMods: Record<WeaponId, WeaponMod> = freshMods();

  // run modifiers
  modifierIds: ModifierId[] = [];
  private mods = resolveModifiers([]);
  private cursedRoom = false;

  // performance
  private tileCanvas: HTMLCanvasElement | null = null;
  private frameAvg = 16.7;
  fps = 60;
  /** 0..1 scale on particle counts, lowered automatically when frames get long */
  private fxScale = 1;
  private colorBuckets = new Map<string, number[]>();

  // progression
  level = 1;
  xp = 0;
  xpNeeded = xpForLevel(1);
  coins = 0;
  kills = 0;
  roomKills = 0;
  killsTarget = 0;
  bosses = 0;
  damageDealt = 0;
  timeSurvived = 0;
  pendingUpgrades: Upgrade[] = [];

  // camera
  private cam = { x: 0, y: 0, shake: 0 };
  private mouse = { x: 0, y: 0, down: false };
  private keys = new Set<string>();
  private levelUpFx = 0;
  private banner = { text: "", time: 0 };

  onHud: (h: HudData) => void = () => {};
  onStateChange: (s: GameState) => void = () => {};
  onRunEnd: (r: RunResult) => void = () => {};
  private hudTimer = 0;

  constructor(canvas: HTMLCanvasElement, settings: Settings, modifiers: ModifierId[] = []) {
    this.canvas = canvas;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("2D canvas not supported");
    this.ctx = c;
    this.settings = settings;
    this.modifierIds = [...modifiers];
    this.mods = resolveModifiers(this.modifierIds);
    this.stats.maxHealth = Math.max(20, Math.round(this.stats.maxHealth * this.mods.playerMaxHp));
    this.player.hp = this.stats.maxHealth;
    if (this.settings.quality === "LOW") this.fxScale = 0.45;
    setSfxVolume(settings.sfx);
    setMusicVolume(settings.music);
    setMuted(settings.muted);
    this.bindEvents();
    this.startRoom(1);
  }

  /* ---------------- lifecycle ---------------- */

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    startMusic();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    stopMusic();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("contextmenu", prevent);
  }

  private bindEvents() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("contextmenu", prevent);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (["w", "a", "s", "d", " ", "e", "escape", "q", "m"].includes(k)) e.preventDefault();
    if (k === "escape") { this.togglePause(); return; }
    if (k === "m") { this.toggleMute(); return; }
    if (k === "q") { this.cycleWeapon(1); return; }
    const slot = Number(k);
    if (slot >= 1 && slot <= WEAPON_ORDER.length) { this.selectWeaponSlot(slot - 1); return; }
    this.keys.add(k);
  };

  /** Weapons are switched with number keys 1-5 or cycled with Q. */
  selectWeaponSlot(i: number) {
    const id = WEAPON_ORDER[i];
    if (!id || !this.unlockedWeapons.includes(id) || id === this.weapon) return;
    this.weapon = id;
    this.player.fireCd = 0.15;
    playSound("ui");
    this.floatText(this.player.x, this.player.y - 34, WEAPONS[id].name, PALETTE.metal3, 8);
    this.pushHud();
  }

  cycleWeapon(dir: number) {
    const list = WEAPON_ORDER.filter((w) => this.unlockedWeapons.includes(w));
    if (list.length < 2) return;
    const i = list.indexOf(this.weapon);
    const next = list[(i + dir + list.length) % list.length]!;
    this.selectWeaponSlot(WEAPON_ORDER.indexOf(next));
  }

  toggleMute() {
    this.settings = { ...this.settings, muted: !this.settings.muted };
    setMuted(this.settings.muted);
    this.onMuteToggle(this.settings.muted);
  }

  onMuteToggle: (muted: boolean) => void = () => {};
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()); };
  private onMouseMove = (e: MouseEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) * (this.canvas.width / r.width);
    this.mouse.y = (e.clientY - r.top) * (this.canvas.height / r.height);
  };
  private onMouseDown = (e: MouseEvent) => { if (e.button === 0) this.mouse.down = true; };
  private onMouseUp = () => { this.mouse.down = false; };

  togglePause() {
    if (this.state === "playing") this.setState("paused");
    else if (this.state === "paused") this.setState("playing");
  }

  private setState(s: GameState) {
    this.state = s;
    this.onStateChange(s);
  }

  resume() { if (this.state === "paused") this.setState("playing"); }

  applyUpgrade(u: Upgrade) {
    u.apply(this.stats);
    if (u.weapon && u.applyWeapon) {
      const m = this.weaponMods[u.weapon];
      u.applyWeapon(m);
      m.tier = Math.min(MAX_WEAPON_TIER, m.tier + 1);
    }
    this.player.hp = Math.min(this.stats.maxHealth, this.player.hp + LEVEL_UP_GAINS.healOnLevel);
    this.pendingUpgrades = [];
    this.setState("playing");
    this.pushHud();
  }

  updateSettings(s: Settings) {
    const prevQuality = this.settings.quality;
    this.settings = s;
    setSfxVolume(s.sfx);
    setMusicVolume(s.music);
    setMuted(s.muted);
    if (s.quality !== prevQuality) this.fxScale = s.quality === "LOW" ? 0.45 : 1;
  }

  /* ---------------- rooms ---------------- */

  private startRoom(n: number) {
    this.roomNumber = n;
    const { map, kind } = buildRoom(n);
    this.map = map;
    this.roomKind = kind;
    this.enemies = [];
    this.projPool.clear();
    this.pickups = [];
    this.partPool.clear();
    this.tileCanvas = null;
    this.cursedRoom = this.mods.cursedRooms && n % 3 === 0;
    this.boss = null;
    this.roomCleared = false;
    this.roomKills = 0;
    this.doorAnim = 0;
    this.player.x = 3.5 * TILE;
    this.player.y = (ROOM_H / 2) * TILE;
    this.exit = { x: (ROOM_W - 2.5) * TILE, y: (ROOM_H / 2) * TILE };
    this.cam.x = this.player.x;
    this.cam.y = this.player.y;

    if (kind === "boss") {
      this.spawnBoss();
      this.killsTarget = 1;
      this.banner = { text: `BOSS — ROOM ${n}`, time: 2.4 };
      playSound("bossWarn");
    } else {
      const base = scaledEnemyCount(enemyCountForRoom(n), this.settings.difficulty);
      const count = Math.max(1, Math.round(base * this.mods.enemyCount));
      this.killsTarget = count;
      for (let i = 0; i < count; i++) this.spawnEnemy();
      this.banner = { text: this.cursedRoom ? `CURSED ROOM ${n}` : `ROOM ${n}`, time: 1.6 };
    }
    this.pushHud();
  }

  private randomFreePos(minDistFromPlayer: number): Vec {
    for (let i = 0; i < 200; i++) {
      const tx = 2 + Math.floor(Math.random() * (ROOM_W - 4));
      const ty = 2 + Math.floor(Math.random() * (ROOM_H - 4));
      if (this.tileAt(tx, ty) !== 0) continue;
      const x = tx * TILE + TILE / 2;
      const y = ty * TILE + TILE / 2;
      if (Math.hypot(x - this.player.x, y - this.player.y) < minDistFromPlayer) continue;
      if (this.circleHitsSolid(x, y, 14)) continue;
      return { x, y };
    }
    return { x: this.worldW / 2, y: this.worldH / 2 };
  }

  /** Cursed rooms stack an extra multiplier on top of the run modifiers. */
  private get curseMul() {
    return this.cursedRoom ? 1.3 : 1;
  }

  private spawnEnemy() {
    const pos = this.randomFreePos(220);
    const isElite = Math.random() < eliteChance(this.level) + this.mods.eliteChanceAdd;
    const kind: EnemyKind = isElite ? "elite" : this.rollEnemyKind();
    const base = ENEMIES[kind];
    const s = getEnemyStats(base, this.level, this.roomNumber, this.settings.difficulty);
    const hp = Math.round(s.health * this.mods.enemyHp * this.curseMul);
    const shield = kind === "shielded" ? Math.round(hp * SHIELD_RATIO) : 0;
    this.enemies.push({
      id: this.enemySeq++,
      kind, name: base.name,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      hp, maxHp: hp,
      dmg: s.damage * this.mods.enemyDmg * this.curseMul,
      speed: s.speed * this.mods.enemySpeed,
      attackRate: s.attackRate, attackRange: base.attackRange, projSpeed: s.projectileSpeed,
      radius: base.radius, size: base.size + (kind === "elite" ? 2 : 0),
      color: base.color, accent: base.accent,
      xp: s.xp, coinChance: s.coinChance, knockbackResist: base.knockbackResist,
      level: s.level, elite: kind === "elite",
      cooldown: Math.random(), flash: 0, state: "idle", hurtTime: 0,
      wobble: Math.random() * 6, telegraph: 0,
      facing: 0, shieldHp: shield, shieldMax: shield, fuse: -1, charge: 0,
    });
  }

  /** Weighted roster that widens as the player descends. */
  private rollEnemyKind(): EnemyKind {
    const r = this.roomNumber;
    const table: { kind: EnemyKind; w: number }[] = [
      { kind: "melee", w: 34 },
      { kind: "fast", w: r >= 2 ? 22 : 0 },
      { kind: "ranged", w: r >= 3 ? 18 : 0 },
      { kind: "bomber", w: r >= 3 ? 14 : 0 },
      { kind: "tank", w: r >= 4 ? 12 : 0 },
      { kind: "shielded", w: r >= 5 ? 16 : 0 },
      { kind: "sniper", w: r >= 6 ? 12 : 0 },
    ];
    let total = 0;
    for (const t of table) total += t.w;
    let roll = Math.random() * total;
    for (const t of table) {
      roll -= t.w;
      if (roll <= 0 && t.w > 0) return t.kind;
    }
    return "melee";
  }

  private spawnBoss() {
    const s = getEnemyStats(
      { health: BOSS_BASE.health, damage: BOSS_BASE.damage, speed: BOSS_BASE.speed, attackRate: 1, projectileSpeed: BOSS_BASE.projectileSpeed, xp: BOSS_BASE.xp, coinChance: 1 },
      this.level, this.roomNumber, this.settings.difficulty,
    );
    const tier = Math.ceil(this.roomNumber / 5);
    const hp = Math.round(s.health * (0.75 + tier * 0.25) * this.mods.bossHp);
    this.boss = {
      x: this.worldW - 6 * TILE, y: this.worldH / 2, vx: 0, vy: 0,
      hp, maxHp: hp, dmg: s.damage * this.mods.bossDmg, speed: s.speed * this.mods.enemySpeed,
      radius: BOSS_BASE.radius,
      projSpeed: s.projectileSpeed, level: s.level, xp: s.xp * 3,
      phase: 1, flash: 0, timer: 1.5, attack: "idle", attackTime: 0,
      spin: 0, attackCd: 0, beamAng: 0, beamDir: 1,
      chargeDir: { x: -1, y: 0 },
      name: tier === 1 ? "THE FOUNDRY WARDEN" : tier === 2 ? "MOLTEN ARCHON" : "GILDED SOVEREIGN",
    };
  }

  /* ---------------- tiles & collision ---------------- */

  private tileAt(tx: number, ty: number): number {
    const row = this.map[ty];
    if (!row) return 1;
    const v = row[tx];
    return v === undefined ? 1 : v;
  }
  private setTile(tx: number, ty: number, v: number) {
    const row = this.map[ty];
    if (row && row[tx] !== undefined) {
      row[tx] = v;
      this.tileCanvas = null; // repaint the cached floor after a crate breaks
    }
  }
  private solid(tx: number, ty: number) {
    const t = this.tileAt(tx, ty);
    return t === 1 || t === 2 || t === 3;
  }
  private circleHitsSolid(x: number, y: number, r: number) {
    const minX = Math.floor((x - r) / TILE), maxX = Math.floor((x + r) / TILE);
    const minY = Math.floor((y - r) / TILE), maxY = Math.floor((y + r) / TILE);
    for (let ty = minY; ty <= maxY; ty++)
      for (let tx = minX; tx <= maxX; tx++)
        if (this.solid(tx, ty)) {
          const cx = clamp(x, tx * TILE, tx * TILE + TILE);
          const cy = clamp(y, ty * TILE, ty * TILE + TILE);
          if ((cx - x) ** 2 + (cy - y) ** 2 < r * r) return true;
        }
    return false;
  }

  private moveWithCollision(e: { x: number; y: number }, dx: number, dy: number, r: number) {
    if (dx !== 0) {
      const nx = e.x + dx;
      if (!this.circleHitsSolid(nx, e.y, r)) e.x = nx;
    }
    if (dy !== 0) {
      const ny = e.y + dy;
      if (!this.circleHitsSolid(e.x, ny, r)) e.y = ny;
    }
    e.x = clamp(e.x, r, this.worldW - r);
    e.y = clamp(e.y, r, this.worldH - r);
  }

  /* ---------------- loop ---------------- */

  private frame = (now: number) => {
    if (!this.running) return;
    const raw = now - this.last;
    const dt = Math.min(0.05, raw / 1000);
    this.last = now;

    // Adaptive fx budget: if frames run long, trim particle counts before FPS drops.
    this.frameAvg += (raw - this.frameAvg) * 0.08;
    this.fps = Math.round(1000 / Math.max(1, this.frameAvg));
    const ceiling = this.settings.quality === "LOW" ? 0.45 : 1;
    if (this.frameAvg > 20) this.fxScale = Math.max(0.2, this.fxScale - 0.02);
    else if (this.frameAvg < 17.2) this.fxScale = Math.min(ceiling, this.fxScale + 0.01);

    if (this.state === "playing") this.update(dt);
    this.render();
    this.hudTimer += dt;
    if (this.hudTimer > 0.08) { this.hudTimer = 0; this.pushHud(); }
    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number) {
    this.timeSurvived += dt;
    if (this.banner.time > 0) this.banner.time -= dt;
    if (this.levelUpFx > 0) this.levelUpFx -= dt;
    this.updateBuffs(dt);
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateCamera(dt);
    this.checkRoomClear();
  }

  private updateBuffs(dt: number) {
    for (const [k, v] of this.buffs) {
      const t = v - dt;
      if (t <= 0) this.buffs.delete(k);
      else this.buffs.set(k, t);
    }
  }

  private effStat() {
    const dmg = this.stats.damage * (this.buffs.has("damage") ? 1.25 : 1) * this.mods.playerDmg;
    const spd = this.stats.moveSpeed * (this.buffs.has("speed") ? 1.15 : 1) * this.mods.playerSpeed;
    const rate = this.stats.attackSpeed * (this.buffs.has("rapid") ? 1.3 : 1);
    const pick = this.stats.pickupRange * (this.buffs.has("magnet") ? 2.4 : 1);
    return { dmg, spd, rate, pick };
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const { spd, rate } = this.effStat();

    // aim
    const world = this.screenToWorld(this.mouse.x, this.mouse.y);
    p.angle = Math.atan2(world.y - p.y, world.x - p.x);

    // input dir
    let dx = 0, dy = 0;
    if (this.keys.has("w")) dy -= 1;
    if (this.keys.has("s")) dy += 1;
    if (this.keys.has("a")) dx -= 1;
    if (this.keys.has("d")) dx += 1;
    const len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; p.walk += dt * 10; }

    // dash
    p.dashCd = Math.max(0, p.dashCd - dt);
    if (this.keys.has(" ") && p.dashCd <= 0 && p.dashTime <= 0) {
      p.dashTime = PLAYER_BASE.dashDuration;
      p.dashCd = this.stats.dashCooldown;
      p.dashDir = len > 0 ? { x: dx, y: dy } : { x: Math.cos(p.angle), y: Math.sin(p.angle) };
      p.invuln = Math.max(p.invuln, PLAYER_BASE.dashDuration + 0.08);
      this.shake(4);
      playSound("dash");
    }

    if (p.dashTime > 0) {
      p.dashTime -= dt;
      const dashSpeed = PLAYER_BASE.dashDistance / PLAYER_BASE.dashDuration;
      this.moveWithCollision(p, p.dashDir.x * dashSpeed * dt, p.dashDir.y * dashSpeed * dt, PLAYER_BASE.radius);
      this.afterimages.push({ x: p.x, y: p.y, life: 0.25, angle: p.angle });
      this.emit(p.x, p.y, 2, PALETTE.blue, 40);
    } else if (len > 0) {
      this.moveWithCollision(p, dx * spd * dt, dy * spd * dt, PLAYER_BASE.radius);
    }

    p.invuln = Math.max(0, p.invuln - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.recoil = Math.max(0, p.recoil - dt * 6);
    p.fireCd = Math.max(0, p.fireCd - dt);

    if (this.mouse.down && p.fireCd <= 0) {
      const w = WEAPONS[this.weapon];
      const mod = this.weaponMods[this.weapon];
      p.fireCd = 1 / Math.max(0.1, rate * w.rate * mod.rate);
      this.shoot(p.angle);
    }

    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const a = this.afterimages[i]!;
      a.life -= dt;
      if (a.life <= 0) this.afterimages.splice(i, 1);
    }

    // exit
    if (this.roomCleared && Math.hypot(p.x - this.exit.x, p.y - this.exit.y) < 34) {
      if (this.keys.has("e")) this.nextRoom();
    }
  }

  private shoot(angle: number) {
    const p = this.player;
    const { dmg } = this.effStat();
    const w = WEAPONS[this.weapon];
    const mod = this.weaponMods[this.weapon];
    const muzzle = 16;
    const pellets = w.pellets + mod.pellets;
    const speed = this.stats.projectileSpeed * w.projSpeed;

    for (let i = 0; i < pellets; i++) {
      const crit = Math.random() < this.stats.critChance;
      const damage = dmg * w.damage * mod.damage * (crit ? this.stats.critDamage : 1);
      const off = pellets > 1 ? (i - (pellets - 1) / 2) * (w.spread / Math.max(1, pellets - 1)) : 0;
      const a = angle + off + (Math.random() - 0.5) * w.spread * 0.3;
      this.spawnProj({
        x: p.x + Math.cos(a) * muzzle,
        y: p.y + Math.sin(a) * muzzle,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        dmg: damage, life: w.bounce > 0 ? 3 : 1.4, size: w.size,
        color: crit ? PALETTE.gold : w.color, crit, friendly: true,
        pierce: w.pierce + mod.pierce, bounce: w.bounce,
        knockback: w.knockback, trail: w.bounce > 0 || w.pierce > 0,
      });
    }

    p.recoil = 1;
    this.shake(w.shake);
    playSound("shoot");
    const puffs = Math.max(1, Math.round(4 * this.fxScale));
    for (let i = 0; i < puffs; i++) {
      const a = angle + (Math.random() - 0.5) * 0.6;
      const pt = this.partPool.spawn();
      if (!pt) break;
      pt.x = p.x + Math.cos(angle) * muzzle;
      pt.y = p.y + Math.sin(angle) * muzzle;
      pt.vx = Math.cos(a) * 90; pt.vy = Math.sin(a) * 90;
      pt.life = 0.12; pt.max = 0.12; pt.size = 2; pt.color = PALETTE.metal3;
    }
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]!;
      e.flash = Math.max(0, e.flash - dt);
      e.cooldown = Math.max(0, e.cooldown - dt);
      e.wobble += dt * 6;
      const dist = Math.hypot(p.x - e.x, p.y - e.y);
      const ang = Math.atan2(p.y - e.y, p.x - e.x);

      // knockback decay
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.vx *= 0.86; e.vy *= 0.86;
      if (this.circleHitsSolid(e.x, e.y, e.radius)) {
        e.x -= e.vx * dt; e.y -= e.vy * dt; e.vx = 0; e.vy = 0;
      }

      if (e.hurtTime > 0) { e.hurtTime -= dt; e.state = "hurt"; continue; }

      // Facing: shielded foes turn slowly, so flanking beats their plate.
      if (e.kind === "shielded") {
        let diff = ang - e.facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        e.facing += clamp(diff, -2.2 * dt, 2.2 * dt);
      } else {
        e.facing = ang;
      }

      const ranged = e.kind === "ranged" || e.kind === "elite";
      if (e.kind === "sniper") {
        // Longeye: holds extreme range, charges a telegraphed piercing bolt.
        const ideal = 330;
        let mx = 0, my = 0;
        if (e.charge > 0) {
          e.state = "attack";
          e.charge -= dt;
          if (e.charge <= 0) {
            e.cooldown = 1 / e.attackRate;
            this.spawnProj({
              x: e.x + Math.cos(ang) * (e.radius + 5), y: e.y + Math.sin(ang) * (e.radius + 5),
              vx: Math.cos(ang) * e.projSpeed, vy: Math.sin(ang) * e.projSpeed,
              dmg: e.dmg, life: 2.2, size: 5, color: e.accent, crit: false, friendly: false,
              trail: true,
            });
            playSound("shoot");
          }
        } else {
          if (dist < ideal - 70) { e.state = "retreat"; mx = -Math.cos(ang); my = -Math.sin(ang); }
          else if (dist > e.attackRange - 40) { e.state = "chase"; mx = Math.cos(ang); my = Math.sin(ang); }
          else { e.state = "idle"; mx = -Math.sin(ang) * 0.4; my = Math.cos(ang) * 0.4; }
          this.moveWithCollision(e, mx * e.speed * dt, my * e.speed * dt, e.radius);
          if (dist < e.attackRange && e.cooldown <= 0) e.charge = 1.1;
        }
      } else if (e.kind === "bomber") {
        // Powderkeg: sprints in, arms a fuse, then detonates in an AoE.
        if (e.fuse >= 0) {
          e.state = "attack";
          e.fuse -= dt;
          this.moveWithCollision(e, Math.cos(ang) * e.speed * 0.35 * dt, Math.sin(ang) * e.speed * 0.35 * dt, e.radius);
          if (e.fuse <= 0) { this.explodeBomber(e); continue; }
        } else {
          e.state = "chase";
          this.moveWithCollision(e, Math.cos(ang) * e.speed * dt, Math.sin(ang) * e.speed * dt, e.radius);
          if (dist < e.attackRange) { e.fuse = 0.75; playSound("bossWarn"); }
        }
      } else if (ranged) {
        const ideal = 170;
        if (dist > ideal + 40) e.state = "chase";
        else if (dist < ideal - 50) e.state = "retreat";
        else e.state = "attack";
        let mx = 0, my = 0;
        if (e.state === "chase") { mx = Math.cos(ang); my = Math.sin(ang); }
        else if (e.state === "retreat") { mx = -Math.cos(ang); my = -Math.sin(ang); }
        else { mx = -Math.sin(ang) * 0.7; my = Math.cos(ang) * 0.7; }
        this.moveWithCollision(e, mx * e.speed * dt, my * e.speed * dt, e.radius);
        if (dist < e.attackRange && e.cooldown <= 0) {
          e.cooldown = 1 / e.attackRate;
          const shots = e.elite ? 3 : 1;
          for (let s = 0; s < shots; s++) {
            const a = ang + (s - (shots - 1) / 2) * 0.22;
            this.spawnProj({
              x: e.x + Math.cos(a) * (e.radius + 4), y: e.y + Math.sin(a) * (e.radius + 4),
              vx: Math.cos(a) * e.projSpeed, vy: Math.sin(a) * e.projSpeed,
              dmg: e.dmg, life: 3, size: e.elite ? 5 : 4,
              color: e.elite ? PALETTE.gold : PALETTE.blue, crit: false, friendly: false,
            });
          }
        }
      } else {
        if (dist > e.attackRange) {
          e.state = "chase";
          // Skitter lunges in bursts once it is close enough.
          let speed = e.speed;
          if (e.kind === "fast") {
            if (e.telegraph > 0) { e.telegraph -= dt; speed = e.speed * 0.25; }
            else if (dist < 150 && e.cooldown <= 0) { e.telegraph = 0.22; e.cooldown = 1.6; }
            else if (e.cooldown > 1.2) speed = e.speed * 2.6;
          }
          // simple obstacle avoidance: try direct, else slide
          const sx = Math.cos(ang) * speed * dt;
          const sy = Math.sin(ang) * speed * dt;
          const beforeX = e.x, beforeY = e.y;
          this.moveWithCollision(e, sx, sy, e.radius);
          if (Math.abs(e.x - beforeX) < 0.01 && Math.abs(e.y - beforeY) < 0.01) {
            const perp = ang + (e.wobble % 2 < 1 ? Math.PI / 2 : -Math.PI / 2);
            this.moveWithCollision(e, Math.cos(perp) * speed * dt, Math.sin(perp) * speed * dt, e.radius);
          }
        } else {
          e.state = "attack";
          if (e.cooldown <= 0) {
            const heavy = e.kind === "tank" || e.kind === "shielded";
            if (heavy && e.telegraph <= 0) {
              e.telegraph = e.kind === "shielded" ? 0.4 : 0.5;
            } else if (e.telegraph > 0) {
              e.telegraph -= dt;
              if (e.telegraph <= 0) { this.damagePlayer(e.dmg * 1.4, ang); e.cooldown = 1 / e.attackRate; this.shake(5); }
            } else {
              this.damagePlayer(e.dmg, ang);
              e.cooldown = 1 / e.attackRate;
            }
          }
        }
      }

      // separation from other enemies
      for (let j = i - 1; j >= 0; j--) {
        const o = this.enemies[j]!;
        const d = Math.hypot(o.x - e.x, o.y - e.y);
        const min = e.radius + o.radius;
        if (d > 0 && d < min) {
          const push = (min - d) / 2;
          const a2 = Math.atan2(o.y - e.y, o.x - e.x);
          this.moveWithCollision(e, -Math.cos(a2) * push, -Math.sin(a2) * push, e.radius);
          this.moveWithCollision(o, Math.cos(a2) * push, Math.sin(a2) * push, o.radius);
        }
      }
    }
  }

  private updateBoss(dt: number) {
    const b = this.boss;
    if (!b) return;
    const p = this.player;
    b.flash = Math.max(0, b.flash - dt);
    const hpPct = b.hp / b.maxHp;
    const newPhase = hpPct > 0.75 ? 1 : hpPct > 0.5 ? 2 : hpPct > 0.25 ? 3 : 4;
    if (newPhase !== b.phase) {
      b.phase = newPhase;
      this.banner = { text: newPhase === 4 ? "ENRAGED — FINAL PHASE" : `PHASE ${newPhase}`, time: 1.6 };
      this.shake(newPhase === 4 ? 16 : 10);
      playSound("bossWarn");
      this.emit(b.x, b.y, 30 + newPhase * 6, newPhase === 4 ? PALETTE.red : PALETTE.gold, 240);
      // Phase transitions clear the floor with a defensive nova.
      const n = 10 + newPhase * 4;
      for (let i = 0; i < n; i++) this.pushBossBullet(b, (i / n) * Math.PI * 2 + newPhase * 0.2);
    }
    const ang = Math.atan2(p.y - b.y, p.x - b.x);
    const aggression = 1 + (b.phase - 1) * 0.35;
    const power = 1 + (b.phase - 1) * 0.2;

    b.timer -= dt * aggression;
    if (b.attack === "idle") {
      const chaseMul = b.phase >= 4 ? 1.1 : 0.6;
      this.moveWithCollision(b, Math.cos(ang) * b.speed * dt * chaseMul, Math.sin(ang) * b.speed * dt * chaseMul, b.radius);
      if (b.timer <= 0) {
        const pool =
          b.phase === 1 ? ["spread", "charge"]
          : b.phase === 2 ? ["spread", "charge", "summon", "ring"]
          : b.phase === 3 ? ["spread", "charge", "summon", "ring", "spiral", "beam"]
          : ["charge", "ring", "spiral", "beam", "beam", "summon"];
        b.attack = pool[Math.floor(Math.random() * pool.length)]!;
        b.attackTime =
          b.attack === "charge" ? 0.7
          : b.attack === "spiral" ? 2.2
          : b.attack === "beam" ? 1.7
          : 0.5;
        if (b.attack === "spiral") b.spin = ang;
        if (b.attack === "beam") { b.beamAng = ang; b.beamDir = Math.random() < 0.5 ? 1 : -1; }
      }
    } else {
      b.attackTime -= dt;
      if (b.attack === "charge") {
        if (b.attackTime > 0.35) {
          b.chargeDir = { x: Math.cos(ang), y: Math.sin(ang) };
        } else if (b.attackTime > -0.5) {
          const speed = b.phase >= 4 ? 660 : 520;
          this.moveWithCollision(b, b.chargeDir.x * speed * dt, b.chargeDir.y * speed * dt, b.radius);
          this.emit(b.x, b.y, 2, PALETTE.red, 60);
          if (Math.hypot(p.x - b.x, p.y - b.y) < b.radius + 14) this.damagePlayer(b.dmg * 1.2 * power, ang);
          // Enraged charges leave a burning trail of shots.
          if (b.phase >= 4 && Math.random() < 0.25) this.pushBossBullet(b, ang + Math.PI + (Math.random() - 0.5));
        } else { this.endBossAttack(b); }
      } else if (b.attack === "spread") {
        if (b.attackTime <= 0) {
          const n = 6 + b.phase * 2;
          for (let i = 0; i < n; i++) {
            const a = ang + (i - (n - 1) / 2) * 0.18;
            this.pushBossBullet(b, a);
          }
          this.endBossAttack(b);
        }
      } else if (b.attack === "ring") {
        if (b.attackTime <= 0) {
          const n = 16 + (b.phase >= 3 ? 8 : 0);
          for (let i = 0; i < n; i++) this.pushBossBullet(b, (i / n) * Math.PI * 2);
          if (b.phase >= 4) for (let i = 0; i < n; i++) this.pushBossBullet(b, (i / n) * Math.PI * 2 + Math.PI / n);
          this.shake(6);
          this.endBossAttack(b);
        }
      } else if (b.attack === "spiral") {
        // Rotating bullet fan that sweeps the whole arena.
        b.spin += dt * 3.4 * (b.phase >= 4 ? 1.5 : 1);
        b.attackCd -= dt;
        if (b.attackCd <= 0) {
          b.attackCd = b.phase >= 4 ? 0.09 : 0.13;
          const arms = b.phase >= 4 ? 4 : 3;
          for (let i = 0; i < arms; i++) this.pushBossBullet(b, b.spin + (i / arms) * Math.PI * 2);
        }
        if (b.attackTime <= 0) this.endBossAttack(b);
      } else if (b.attack === "beam") {
        // Telegraphed sweeping beam: 0.6s warning, then a rotating damage line.
        if (b.attackTime > 1.1) {
          b.beamAng = ang;
        } else {
          b.beamAng += b.beamDir * dt * (b.phase >= 4 ? 1.5 : 1.0);
          const dx = p.x - b.x, dy = p.y - b.y;
          const d = Math.hypot(dx, dy);
          let diff = Math.atan2(dy, dx) - b.beamAng;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (d < 600 && Math.abs(diff) < 0.12) this.damagePlayer(b.dmg * 0.9 * power, b.beamAng);
          if (Math.random() < 0.6) {
            const t = 60 + Math.random() * 520;
            this.addParticle(b.x + Math.cos(b.beamAng) * t, b.y + Math.sin(b.beamAng) * t, 0.2, 3, PALETTE.red);
          }
        }
        if (b.attackTime <= 0) this.endBossAttack(b);
      } else if (b.attack === "summon") {
        if (b.attackTime <= 0) {
          for (let i = 0; i < 2 + b.phase; i++) this.spawnEnemy();
          this.killsTarget += 2 + b.phase;
          this.endBossAttack(b);
        }
      }
    }
  }

  private pushBossBullet(b: Boss, a: number) {
    this.spawnProj({
      x: b.x + Math.cos(a) * (b.radius + 6), y: b.y + Math.sin(a) * (b.radius + 6),
      vx: Math.cos(a) * b.projSpeed, vy: Math.sin(a) * b.projSpeed,
      dmg: b.dmg, life: 4, size: 6, color: PALETTE.red, crit: false, friendly: false,
      trail: true,
    });
  }
  private endBossAttack(b: Boss) {
    b.attack = "idle";
    b.timer = Math.max(0.6, 2.0 - b.phase * 0.35);
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projPool.count - 1; i >= 0; i--) {
      const pr = this.projPool.items[i]!;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      let dead = pr.life <= 0;
      if (!dead && this.circleHitsSolid(pr.x, pr.y, pr.size / 2)) {
        const tx = Math.floor(pr.x / TILE), ty = Math.floor(pr.y / TILE);
        if (pr.friendly && this.tileAt(tx, ty) === 2) this.breakCrate(tx, ty);
        this.emit(pr.x, pr.y, 5, pr.color, 90);
        if (pr.bounce > 0) {
          // Reflect off whichever axis is blocked (arc orb ricochet).
          pr.bounce--;
          const hitX = this.circleHitsSolid(pr.x + Math.sign(pr.vx) * pr.size, pr.y - pr.vy * dt, pr.size / 2);
          if (hitX) pr.vx = -pr.vx; else pr.vy = -pr.vy;
          pr.x += pr.vx * dt * 2; pr.y += pr.vy * dt * 2;
          if (this.circleHitsSolid(pr.x, pr.y, pr.size / 2)) { pr.vx = -pr.vx; pr.vy = -pr.vy; }
        } else {
          dead = true;
        }
      }
      if (!dead && pr.friendly) {
        for (const e of this.enemies) {
          if (pr.hits.includes(e.id)) continue;
          if (Math.hypot(e.x - pr.x, e.y - pr.y) < e.radius + pr.size) {
            this.hitEnemy(e, pr.dmg, pr.crit, Math.atan2(pr.vy, pr.vx), pr.knockback);
            if (pr.pierce > 0) { pr.pierce--; pr.hits.push(e.id); }
            else dead = true;
            break;
          }
        }
        const b = this.boss;
        if (!dead && b && Math.hypot(b.x - pr.x, b.y - pr.y) < b.radius + pr.size && !pr.hits.includes(-1)) {
          b.hp -= pr.dmg; b.flash = 0.1;
          this.damageDealt += pr.dmg;
          this.spawnDamageText(b.x, b.y - b.radius, pr.dmg, pr.crit);
          this.emit(pr.x, pr.y, 6, PALETTE.gold, 110);
          playSound("hit");
          if (b.hp <= 0) this.killBoss(b);
          if (pr.pierce > 0) { pr.pierce--; pr.hits.push(-1); }
          else dead = true;
        }
      } else if (!dead) {
        if (Math.hypot(this.player.x - pr.x, this.player.y - pr.y) < PLAYER_BASE.radius + pr.size) {
          this.damagePlayer(pr.dmg, Math.atan2(pr.vy, pr.vx));
          dead = true;
        }
      }
      if (dead) this.projPool.removeAt(i);
      else if (pr.trail && this.settings.particles && Math.random() < 0.5 * this.fxScale) {
        this.addParticle(pr.x, pr.y, 0.15, 2, pr.color);
      }
    }
  }

  private breakCrate(tx: number, ty: number) {
    this.setTile(tx, ty, 0);
    const x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2;
    this.emit(x, y, 12, PALETTE.crate1, 130);
    playSound("break");
    const r = Math.random();
    if (r < 0.3) this.dropPickup(x, y, "coin", 1);
    else if (r < 0.45) this.dropPickup(x, y, "health", 15);
    else if (r < 0.6) this.dropPickup(x, y, "xp", 8);
  }

  /** Powderkeg detonation: area damage to the player and nearby foes. */
  private explodeBomber(e: Enemy) {
    const radius = 82;
    this.emit(e.x, e.y, 26, PALETTE.red, 240);
    this.emit(e.x, e.y, 12, PALETTE.gold, 160);
    this.shake(9);
    playSound("bossDeath");
    if (Math.hypot(this.player.x - e.x, this.player.y - e.y) < radius + PLAYER_BASE.radius) {
      this.damagePlayer(e.dmg, Math.atan2(this.player.y - e.y, this.player.x - e.x));
    }
    for (const o of [...this.enemies]) {
      if (o === e) continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d < radius) this.hitEnemy(o, e.dmg * 0.5, false, Math.atan2(o.y - e.y, o.x - e.x), 260);
    }
    e.hp = 0;
    this.killEnemy(e);
  }

  private hitEnemy(e: Enemy, dmg: number, crit: boolean, angle: number, knockback = 220) {
    // Aegis plate: shots into its front are mostly absorbed until it breaks.
    if (e.shieldHp > 0) {
      let diff = angle + Math.PI - e.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 1.1) {
        e.shieldHp -= dmg;
        e.flash = 0.1;
        this.emit(e.x + Math.cos(e.facing) * e.radius, e.y + Math.sin(e.facing) * e.radius, 5, PALETTE.blue, 120);
        playSound("hit");
        if (e.shieldHp <= 0) {
          e.shieldHp = 0;
          this.floatText(e.x, e.y - e.size / 2, "SHIELD BROKEN", PALETTE.gold, 7);
          this.emit(e.x, e.y, 14, PALETTE.metal3, 180);
        } else {
          this.floatText(e.x, e.y - e.size / 2, "BLOCK", PALETTE.blue, 7);
        }
        dmg *= 0.15;
      }
    }
    e.hp -= dmg;
    e.flash = 0.12;
    this.damageDealt += dmg;
    const kb = knockback * (1 - e.knockbackResist);
    e.vx += Math.cos(angle) * kb;
    e.vy += Math.sin(angle) * kb;
    this.spawnDamageText(e.x, e.y - e.size / 2, dmg, crit);
    this.emit(e.x, e.y, 5, e.color, 110);
    playSound("hit");
    if (e.hp <= 0) this.killEnemy(e);
    else e.hurtTime = 0.08;
  }

  private killEnemy(e: Enemy) {
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
    this.kills++; this.roomKills++;
    this.emit(e.x, e.y, 18, e.color, 170);
    this.emit(e.x, e.y, 6, PALETTE.white, 120);
    playSound("death");
    const orbs = e.elite ? 4 : e.kind === "tank" ? 3 : 2;
    for (let i = 0; i < orbs; i++) this.dropPickup(e.x, e.y, "xp", Math.ceil(e.xp / orbs));
    if (Math.random() < e.coinChance) this.dropPickup(e.x, e.y, "coin", e.elite ? 5 : 1 + Math.floor(Math.random() * 3));
    if (Math.random() < 0.1) this.dropPickup(e.x, e.y, "health", 20);
    if (Math.random() < (e.elite ? 0.5 : 0.08)) {
      const powers: PowerKind[] = ["damage", "speed", "rapid", "shield", "magnet"];
      this.dropPickup(e.x, e.y, "power", 0, powers[Math.floor(Math.random() * powers.length)]!);
    }
  }

  private killBoss(b: Boss) {
    this.boss = null;
    this.bosses++;
    this.kills++;
    this.shake(16);
    playSound("bossDeath");
    for (let i = 0; i < 60; i++) this.emit(b.x, b.y, 1, i % 2 ? PALETTE.gold : PALETTE.red, 260);
    for (let i = 0; i < 10; i++) this.dropPickup(b.x, b.y, "xp", Math.ceil(b.xp / 10));
    for (let i = 0; i < 8; i++) this.dropPickup(b.x, b.y, "coin", 5);
    this.dropPickup(b.x, b.y, "health", 40);
  }

  private dropPickup(x: number, y: number, kind: Pickup["kind"], value: number, power?: PowerKind) {
    const a = Math.random() * Math.PI * 2;
    const s = 40 + Math.random() * 70;
    const item: Pickup = { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 30, kind, value };
    if (power) item.power = power;
    this.pickups.push(item);
  }

  private updatePickups(dt: number) {
    const p = this.player;
    const { pick } = this.effStat();
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i]!;
      k.life -= dt;
      k.x += k.vx * dt; k.y += k.vy * dt;
      k.vx *= 0.9; k.vy *= 0.9;
      const d = Math.hypot(p.x - k.x, p.y - k.y);
      if (d < pick) {
        const a = Math.atan2(p.y - k.y, p.x - k.x);
        const pull = 320 * (1 - d / pick) + 60;
        k.x += Math.cos(a) * pull * dt;
        k.y += Math.sin(a) * pull * dt;
      }
      if (d < 16) {
        this.collect(k);
        this.pickups.splice(i, 1);
      } else if (k.life <= 0) this.pickups.splice(i, 1);
    }
  }

  private collect(k: Pickup) {
    playSound("pickup");
    if (k.kind === "xp") {
      this.xp += Math.round(k.value * this.stats.xpGain * this.mods.xpGain);
      while (this.xp >= this.xpNeeded) this.levelUp();
    } else if (k.kind === "coin") {
      const gain = Math.max(1, Math.round(k.value * this.mods.lootMul * (this.cursedRoom ? 2 : 1)));
      this.coins += gain;
      this.floatText(this.player.x, this.player.y - 20, `+${gain}`, PALETTE.gold);
    } else if (k.kind === "health") {
      this.player.hp = Math.min(this.stats.maxHealth, this.player.hp + k.value);
      this.floatText(this.player.x, this.player.y - 20, `+${k.value} HP`, PALETTE.green);
    } else if (k.kind === "power" && k.power) {
      if (k.power === "shield") this.player.shield = true;
      else this.buffs.set(k.power, 10);
      this.floatText(this.player.x, this.player.y - 20, k.power.toUpperCase(), PALETTE.blue);
    }
  }

  private levelUp() {
    this.xp -= this.xpNeeded;
    this.level++;
    this.xpNeeded = xpForLevel(this.level);
    this.stats.maxHealth += LEVEL_UP_GAINS.maxHealth;
    this.stats.damage += LEVEL_UP_GAINS.damage;
    this.player.hp = Math.min(this.stats.maxHealth, this.player.hp + LEVEL_UP_GAINS.healOnLevel);
    this.levelUpFx = 1.2;
    this.emit(this.player.x, this.player.y, 30, PALETTE.green, 200);
    this.floatText(this.player.x, this.player.y - 30, "LEVEL UP!", PALETTE.green);
    playSound("levelup");
    // Existing enemies get a gentle top-up so the world keeps pace immediately.
    for (const e of this.enemies) {
      const grow = 1.08;
      e.maxHp = Math.round(e.maxHp * grow);
      e.hp = Math.min(e.maxHp, Math.round(e.hp * grow));
      e.dmg = Math.round(e.dmg * 1.05 * 10) / 10;
      e.level = Math.max(e.level, this.level);
    }
    if (this.boss) {
      this.boss.dmg = Math.round(this.boss.dmg * 1.05 * 10) / 10;
      this.boss.level = Math.max(this.boss.level, this.level);
    }
    // New weapons unlock as the run deepens.
    for (const id of weaponUnlocksAtLevel(this.level)) {
      if (!this.unlockedWeapons.includes(id)) {
        this.unlockedWeapons.push(id);
        this.floatText(this.player.x, this.player.y - 48, `${WEAPONS[id].name} UNLOCKED`, PALETTE.metal3, 8);
      }
    }
    this.pendingUpgrades = rollUpgrades(3, weaponUpgrades(this.unlockedWeapons, this.weaponMods));
    this.setState("levelup");
  }

  private damagePlayer(raw: number, angle: number) {
    const p = this.player;
    if (p.invuln > 0 || this.state !== "playing") return;
    if (p.shield) {
      p.shield = false;
      p.invuln = 0.6;
      this.floatText(p.x, p.y - 24, "BLOCKED", PALETTE.blue);
      this.emit(p.x, p.y, 14, PALETTE.blue, 160);
      return;
    }
    const dmg = Math.max(1, raw - this.stats.armor);
    p.hp -= dmg;
    p.invuln = PLAYER_BASE.invulnTime;
    p.flash = 0.3;
    p.vx = 0;
    this.moveWithCollision(p, Math.cos(angle) * 14, Math.sin(angle) * 14, PLAYER_BASE.radius);
    this.shake(7);
    this.floatText(p.x, p.y - 24, `-${Math.round(dmg)}`, PALETTE.red);
    this.emit(p.x, p.y, 10, PALETTE.red, 140);
    playSound("hurt");
    if (p.hp <= 0) {
      p.hp = 0;
      this.endRun(false);
    }
  }

  private checkRoomClear() {
    if (this.roomCleared) { this.doorAnim = Math.min(1, this.doorAnim + 0.02); return; }
    if (this.enemies.length === 0 && !this.boss) {
      this.roomCleared = true;
      playSound("door");
      this.banner = { text: this.roomNumber >= FINAL_ROOM ? "FINAL BOSS DEFEATED" : "ROOM CLEARED — HOLD E AT THE EXIT", time: 3 };
      this.dropPickup(this.exit.x - 40, this.exit.y, "health", 25);
      this.dropPickup(this.exit.x - 60, this.exit.y - 20, "coin", 5);
      if (this.roomNumber >= FINAL_ROOM) this.endRun(true);
    }
  }

  private nextRoom() {
    if (this.roomNumber >= FINAL_ROOM) { this.endRun(true); return; }
    this.startRoom(this.roomNumber + 1);
  }

  private endRun(victory: boolean) {
    this.setState(victory ? "victory" : "gameover");
    playSound(victory ? "victory" : "gameover");
    this.onRunEnd(this.getResult());
  }

  getResult(): RunResult {
    const score = Math.round(
      (this.kills * 25 + this.coins * 10 + (this.roomNumber - 1) * 300 +
        this.bosses * 1000 + this.level * 150 + this.damageDealt * 0.5) * this.mods.scoreMul,
    );
    return {
      score, level: this.level, rooms: this.roomNumber - (this.roomCleared ? 0 : 1),
      kills: this.kills, coins: this.coins, bosses: this.bosses,
      damage: Math.round(this.damageDealt), time: Math.round(this.timeSurvived),
    };
  }

  /* ---------------- fx ---------------- */

  private shake(v: number) { if (this.settings.shake) this.cam.shake = Math.min(18, this.cam.shake + v); }

  private emit(x: number, y: number, n: number, color: string, speed: number) {
    if (!this.settings.particles) return;
    const count = Math.max(1, Math.round(n * this.fxScale));
    for (let i = 0; i < count; i++) {
      const p = this.partPool.spawn();
      if (!p) return; // pool full: drop extra fx instead of allocating
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      const life = 0.25 + Math.random() * 0.35;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.life = life; p.max = life;
      p.size = 1 + Math.floor(Math.random() * 3);
      p.color = color;
    }
  }

  private addParticle(x: number, y: number, life: number, size: number, color: string) {
    const p = this.partPool.spawn();
    if (!p) return;
    p.x = x; p.y = y; p.vx = 0; p.vy = 0;
    p.life = life; p.max = life; p.size = size; p.color = color;
  }

  private spawnProj(o: {
    x: number; y: number; vx: number; vy: number; dmg: number; life: number;
    size: number; color: string; crit: boolean; friendly: boolean;
    pierce?: number; bounce?: number; knockback?: number; trail?: boolean;
  }) {
    const p = this.projPool.spawn();
    if (!p) return;
    p.x = o.x; p.y = o.y; p.vx = o.vx; p.vy = o.vy;
    p.dmg = o.dmg; p.life = o.life; p.size = o.size; p.color = o.color;
    p.crit = o.crit; p.friendly = o.friendly;
    p.pierce = o.pierce ?? 0; p.bounce = o.bounce ?? 0;
    p.knockback = o.knockback ?? 220; p.trail = o.trail ?? false;
    p.hits.length = 0;
  }

  private spawnDamageText(x: number, y: number, dmg: number, crit: boolean) {
    this.floatText(x + (Math.random() - 0.5) * 12, y, `${Math.round(dmg)}${crit ? "!" : ""}`, crit ? PALETTE.gold : PALETTE.white, crit ? 12 : 9);
  }
  private floatText(x: number, y: number, text: string, color: string, size = 10) {
    this.texts.push({ x, y, vy: -34, life: 0.8, text, color, size });
  }

  private updateParticles(dt: number) {
    for (let i = this.partPool.count - 1; i >= 0; i--) {
      const p = this.partPool.items[i]!;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) this.partPool.removeAt(i);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]!;
      t.y += t.vy * dt; t.vy *= 0.94; t.life -= dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  private updateCamera(dt: number) {
    const vw = this.canvas.width, vh = this.canvas.height;
    const tx = clamp(this.player.x, vw / 2, Math.max(vw / 2, this.worldW - vw / 2));
    const ty = clamp(this.player.y, vh / 2, Math.max(vh / 2, this.worldH - vh / 2));
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 8);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 8);
    this.cam.shake *= 0.88;
    if (this.cam.shake < 0.1) this.cam.shake = 0;
  }

  private screenToWorld(sx: number, sy: number): Vec {
    return {
      x: sx + this.cam.x - this.canvas.width / 2,
      y: sy + this.cam.y - this.canvas.height / 2,
    };
  }

  /* ---------------- render ---------------- */

  private render() {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, w, h);

    const shakeX = (Math.random() - 0.5) * this.cam.shake;
    const shakeY = (Math.random() - 0.5) * this.cam.shake;
    const ox = Math.round(-this.cam.x + w / 2 + shakeX);
    const oy = Math.round(-this.cam.y + h / 2 + shakeY);

    ctx.save();
    ctx.translate(ox, oy);

    this.drawTiles(ctx);
    this.drawExit(ctx);
    this.drawPickups(ctx);
    for (const a of this.afterimages) {
      ctx.globalAlpha = a.life * 2.4;
      this.drawPlayerSprite(ctx, a.x, a.y, a.angle, true);
      ctx.globalAlpha = 1;
    }
    this.drawEnemies(ctx);
    this.drawBoss(ctx);
    this.drawPlayer(ctx);
    this.drawProjectiles(ctx);
    this.drawParticles(ctx);
    this.drawTexts(ctx);
    ctx.restore();

    this.drawVignette(ctx, w, h);
    this.drawBanner(ctx, w, h);
  }

  /** The room floor never animates, so it is painted once to an offscreen canvas and blitted. */
  private drawTiles(ctx: CanvasRenderingContext2D) {
    const cache = this.getTileCanvas();
    if (cache) { ctx.drawImage(cache, 0, 0); return; }
    this.paintTiles(ctx, 0, ROOM_W - 1, 0, ROOM_H - 1);
  }

  private getTileCanvas(): HTMLCanvasElement | null {
    if (this.tileCanvas) return this.tileCanvas;
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = ROOM_W * TILE;
    c.height = ROOM_H * TILE;
    const cx = c.getContext("2d");
    if (!cx) return null;
    cx.imageSmoothingEnabled = false;
    this.paintTiles(cx, 0, ROOM_W - 1, 0, ROOM_H - 1);
    this.tileCanvas = c;
    return c;
  }

  private paintTiles(ctx: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number) {


    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.tileAt(tx, ty);
        const px = tx * TILE, py = ty * TILE;
        if (t === 0) {
          const alt = (tx + ty) % 2 === 0;
          ctx.fillStyle = alt ? PALETTE.wood1 : PALETTE.wood2;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = "rgba(23,23,25,0.35)";
          ctx.fillRect(px, py + TILE - 2, TILE, 2);
          ctx.fillStyle = "rgba(138,96,71,0.5)";
          ctx.fillRect(px + 4, py + 8, 3, 2);
          ctx.fillRect(px + 20, py + 20, 4, 2);
        } else if (t === 1) {
          ctx.fillStyle = PALETTE.metal1;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = PALETTE.metal3;
          ctx.fillRect(px + 2, py + 2, TILE - 4, 6);
          ctx.fillStyle = PALETTE.metal2;
          ctx.fillRect(px + 4, py + 12, TILE - 8, TILE - 18);
          ctx.fillStyle = PALETTE.outline;
          ctx.fillRect(px, py, TILE, 2);
          ctx.fillRect(px, py + TILE - 3, TILE, 3);
          ctx.fillRect(px, py, 2, TILE);
          ctx.fillRect(px + TILE - 2, py, 2, TILE);
        } else if (t === 2) {
          ctx.fillStyle = PALETTE.wood2;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = PALETTE.crate1;
          ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          ctx.fillStyle = PALETTE.crate2;
          ctx.fillRect(px + 5, py + 5, TILE - 10, TILE - 10);
          ctx.fillStyle = PALETTE.wood1;
          ctx.fillRect(px + 2, py + TILE / 2 - 1, TILE - 4, 3);
          ctx.fillStyle = PALETTE.outline;
          ctx.strokeStyle = PALETTE.outline;
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
        } else if (t === 3) {
          ctx.fillStyle = PALETTE.wood1;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = PALETTE.outline;
          ctx.fillRect(px + 4, py + 6, TILE - 8, TILE - 8);
          ctx.fillStyle = PALETTE.metal1;
          ctx.fillRect(px + 6, py + 4, TILE - 12, TILE - 10);
          ctx.fillStyle = PALETTE.metal3;
          ctx.fillRect(px + 8, py + 6, 4, TILE - 14);
        }
      }
    }
  }

  private drawExit(ctx: CanvasRenderingContext2D) {
    const { x, y } = this.exit;
    const open = this.roomCleared;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = PALETTE.outline;
    ctx.fillRect(-18, -28, 36, 56);
    ctx.fillStyle = open ? PALETTE.green : PALETTE.metal1;
    ctx.fillRect(-14, -24, 28, 48);
    if (open) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      ctx.globalAlpha = 0.35 + pulse * 0.4;
      ctx.fillStyle = PALETTE.green;
      ctx.fillRect(-22, -32, 44, 64);
      ctx.globalAlpha = 1;
      ctx.fillStyle = PALETTE.bg;
      ctx.fillRect(-10, -20, 20, 40);
      ctx.fillStyle = PALETTE.white;
      ctx.font = "10px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillText("E", 0, 4);
    } else {
      ctx.fillStyle = PALETTE.metal3;
      ctx.fillRect(-14, -24, 28, 4);
      ctx.fillStyle = PALETTE.red;
      ctx.fillRect(-6, -4, 12, 8);
    }
    ctx.restore();
  }

  private shadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    ctx.fillStyle = "rgba(23,23,25,0.45)";
    ctx.fillRect(x - r, y + r * 0.55, r * 2, Math.max(3, r * 0.5));
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    if (p.invuln > 0 && Math.floor(performance.now() / 60) % 2 === 0 && p.dashTime <= 0) {
      ctx.globalAlpha = 0.45;
    }
    this.drawPlayerSprite(ctx, p.x, p.y, p.angle, false);
    ctx.globalAlpha = 1;
    if (p.shield) {
      ctx.strokeStyle = PALETTE.blue;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (this.levelUpFx > 0) {
      const r = (1.2 - this.levelUpFx) * 90;
      ctx.strokeStyle = PALETTE.green;
      ctx.globalAlpha = this.levelUpFx;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private drawPlayerSprite(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, ghost: boolean) {
    const p = this.player;
    this.shadow(ctx, x, y, 10);
    const bob = Math.sin(p.walk) * 1.2;
    const px = Math.round(x), py = Math.round(y + bob);
    // outline
    ctx.fillStyle = PALETTE.outline;
    ctx.fillRect(px - 10, py - 14, 20, 26);
    // legs
    ctx.fillStyle = PALETTE.wood1;
    ctx.fillRect(px - 8, py + 4, 6, 8);
    ctx.fillRect(px + 2, py + 4, 6, 8);
    // torso
    ctx.fillStyle = ghost ? PALETTE.blue : p.flash > 0 ? PALETTE.red : PALETTE.metal1;
    ctx.fillRect(px - 8, py - 6, 16, 12);
    ctx.fillStyle = ghost ? PALETTE.blue : PALETTE.metal3;
    ctx.fillRect(px - 6, py - 4, 12, 4);
    // head
    ctx.fillStyle = PALETTE.crate2;
    ctx.fillRect(px - 6, py - 14, 12, 9);
    ctx.fillStyle = PALETTE.outline;
    ctx.fillRect(px - 6, py - 14, 12, 3);
    ctx.fillStyle = PALETTE.green;
    ctx.fillRect(px - 4, py - 10, 3, 2);
    ctx.fillRect(px + 1, py - 10, 3, 2);
    // weapon
    const recoil = p.recoil * 4;
    ctx.save();
    ctx.translate(px, py - 1);
    ctx.rotate(angle);
    ctx.fillStyle = PALETTE.outline;
    ctx.fillRect(6 - recoil, -4, 18, 8);
    ctx.fillStyle = PALETTE.metal2;
    ctx.fillRect(7 - recoil, -3, 15, 6);
    ctx.fillStyle = PALETTE.green;
    ctx.fillRect(18 - recoil, -2, 4, 4);
    if (p.recoil > 0.6) {
      ctx.fillStyle = PALETTE.metal3;
      ctx.fillRect(22 - recoil, -5, 8, 10);
    }
    ctx.restore();
  }

  private drawEnemies(ctx: CanvasRenderingContext2D) {
    for (const e of this.enemies) {
      const s = e.size;
      const x = Math.round(e.x), y = Math.round(e.y + Math.sin(e.wobble) * 1.2);
      this.shadow(ctx, e.x, e.y, e.radius);
      if (e.elite) {
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(performance.now() / 180);
        ctx.fillStyle = PALETTE.gold;
        ctx.fillRect(x - s / 2 - 4, y - s / 2 - 4, s + 8, s + 8);
        ctx.globalAlpha = 1;
      }
      const body = e.flash > 0 ? PALETTE.white : e.color;
      ctx.fillStyle = PALETTE.outline;
      ctx.fillRect(x - s / 2 - 2, y - s / 2 - 2, s + 4, s + 4);
      ctx.fillStyle = body;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
      ctx.fillStyle = e.accent;
      if (e.kind === "ranged") {
        ctx.fillRect(x - s / 4, y - s / 4, s / 2, s / 4);
        ctx.fillRect(x - s / 2 + 2, y + 2, s - 4, 3);
      } else if (e.kind === "tank") {
        ctx.fillRect(x - s / 2 + 3, y - s / 2 + 3, s - 6, 5);
        ctx.fillRect(x - 4, y - 2, 8, 8);
      } else if (e.kind === "fast") {
        ctx.fillRect(x - s / 3, y - s / 3, 4, 4);
        ctx.fillRect(x + s / 6, y - s / 3, 4, 4);
      } else if (e.kind === "bomber") {
        const hot = e.fuse >= 0 && Math.sin(performance.now() / 60) > 0;
        ctx.fillStyle = hot ? PALETTE.white : e.accent;
        ctx.fillRect(x - 5, y - s / 2 - 4, 10, 5);
        ctx.fillRect(x - s / 4, y - 2, s / 2, s / 4);
      } else if (e.kind === "sniper") {
        ctx.fillRect(x - s / 2 + 2, y - s / 4, s - 4, 4);
        ctx.fillRect(x - 3, y + 2, 6, 6);
      } else if (e.kind === "shielded") {
        ctx.fillRect(x - s / 4, y - s / 4, s / 2, 4);
      } else {
        ctx.fillRect(x - s / 3, y - s / 4, 4, 4);
        ctx.fillRect(x + s / 6, y - s / 4, 4, 4);
      }

      // Aegis plate, drawn on the side it is guarding.
      if (e.shieldHp > 0) {
        const sx = x + Math.cos(e.facing) * (e.radius + 5);
        const sy = y + Math.sin(e.facing) * (e.radius + 5);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(e.facing);
        ctx.fillStyle = PALETTE.outline;
        ctx.fillRect(-3, -s / 2 - 2, 7, s + 4);
        ctx.fillStyle = PALETTE.metal2;
        ctx.fillRect(-2, -s / 2, 5, s);
        ctx.fillStyle = PALETTE.metal3;
        ctx.fillRect(-2, -s / 2, 5, s * clamp(e.shieldHp / e.shieldMax, 0, 1));
        ctx.restore();
      }

      // Sniper charge beam telegraph.
      if (e.kind === "sniper" && e.charge > 0) {
        ctx.globalAlpha = 0.35 + 0.3 * Math.sin(performance.now() / 40);
        ctx.strokeStyle = e.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(e.facing) * 520, y + Math.sin(e.facing) * 520);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Bomber blast radius warning.
      if (e.kind === "bomber" && e.fuse >= 0) {
        ctx.globalAlpha = 0.18 + 0.18 * Math.sin(performance.now() / 50);
        ctx.fillStyle = PALETTE.red;
        ctx.beginPath();
        ctx.arc(x, y, 82, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      if (e.telegraph > 0) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = PALETTE.red;
        ctx.fillRect(x - s, y - s, s * 2, s * 2);
        ctx.globalAlpha = 1;
      }
      // hp bar
      const bw = Math.max(20, s);
      const pct = clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = PALETTE.outline;
      ctx.fillRect(x - bw / 2 - 1, y - s / 2 - 10, bw + 2, e.elite ? 6 : 4);
      ctx.fillStyle = e.elite ? PALETTE.gold : PALETTE.red;
      ctx.fillRect(x - bw / 2, y - s / 2 - 9, bw * pct, e.elite ? 4 : 2);
      if (e.elite || e.kind === "tank") {
        ctx.fillStyle = PALETTE.white;
        ctx.font = "6px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        ctx.fillText(`LV${e.level}`, x, y - s / 2 - 13);
      }
    }
  }

  private drawBoss(ctx: CanvasRenderingContext2D) {
    const b = this.boss;
    if (!b) return;
    const s = BOSS_BASE.size;
    const x = Math.round(b.x), y = Math.round(b.y);
    this.shadow(ctx, b.x, b.y, b.radius);
    ctx.globalAlpha = (b.phase >= 4 ? 0.3 : 0.2) + 0.1 * Math.sin(performance.now() / 150);
    ctx.fillStyle = b.phase >= 3 ? PALETTE.red : PALETTE.gold;
    ctx.fillRect(x - s / 2 - 8, y - s / 2 - 8, s + 16, s + 16);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.outline;
    ctx.fillRect(x - s / 2 - 3, y - s / 2 - 3, s + 6, s + 6);
    ctx.fillStyle = b.flash > 0 ? PALETTE.white : b.phase >= 4 ? PALETTE.wood2 : PALETTE.metal1;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    ctx.fillStyle = PALETTE.metal3;
    ctx.fillRect(x - s / 2 + 6, y - s / 2 + 6, s - 12, 10);
    ctx.fillStyle = b.phase >= 2 ? PALETTE.red : PALETTE.green;
    ctx.fillRect(x - 20, y - 6, 12, 12);
    ctx.fillRect(x + 8, y - 6, 12, 12);
    ctx.fillStyle = PALETTE.outline;
    ctx.fillRect(x - 16, y + 16, 32, 8);
    if (b.attack === "charge" && b.attackTime > 0.35) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = PALETTE.red;
      ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.globalAlpha = 1;
    }
    // Sweeping beam: faint warning line, then a solid blazing beam.
    if (b.attack === "beam") {
      const warning = b.attackTime > 1.1;
      ctx.globalAlpha = warning ? 0.3 : 0.85;
      ctx.strokeStyle = warning ? PALETTE.gold : PALETTE.red;
      ctx.lineWidth = warning ? 3 : 9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(b.beamAng) * 620, y + Math.sin(b.beamAng) * 620);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
    }
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D) {
    // Pass 1: all outlines with a single fillStyle, pass 2: coloured cores.
    ctx.fillStyle = PALETTE.outline;
    for (let i = 0; i < this.projPool.count; i++) {
      const p = this.projPool.items[i]!;
      ctx.fillRect(Math.round(p.x - p.size - 1), Math.round(p.y - p.size - 1), p.size * 2 + 2, p.size * 2 + 2);
    }
    let last = "";
    for (let i = 0; i < this.projPool.count; i++) {
      const p = this.projPool.items[i]!;
      if (p.color !== last) { ctx.fillStyle = p.color; last = p.color; }
      ctx.fillRect(Math.round(p.x - p.size), Math.round(p.y - p.size), p.size * 2, p.size * 2);
    }
  }

  private drawPickups(ctx: CanvasRenderingContext2D) {
    const t = performance.now() / 300;
    for (const k of this.pickups) {
      const bob = Math.sin(t + k.x) * 2;
      const x = Math.round(k.x), y = Math.round(k.y + bob);
      if (k.kind === "xp") {
        ctx.fillStyle = PALETTE.outline;
        ctx.fillRect(x - 4, y - 4, 8, 8);
        ctx.fillStyle = PALETTE.green;
        ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.fillStyle = PALETTE.white;
        ctx.fillRect(x - 1, y - 1, 2, 2);
      } else if (k.kind === "coin") {
        ctx.fillStyle = PALETTE.outline;
        ctx.fillRect(x - 5, y - 5, 10, 10);
        ctx.fillStyle = PALETTE.gold;
        ctx.fillRect(x - 4, y - 4, 8, 8);
        ctx.fillStyle = PALETTE.metal3;
        ctx.fillRect(x - 2, y - 2, 2, 4);
      } else if (k.kind === "health") {
        ctx.fillStyle = PALETTE.outline;
        ctx.fillRect(x - 6, y - 6, 12, 12);
        ctx.fillStyle = PALETTE.red;
        ctx.fillRect(x - 5, y - 5, 10, 10);
        ctx.fillStyle = PALETTE.white;
        ctx.fillRect(x - 1, y - 4, 3, 9);
        ctx.fillRect(x - 4, y - 1, 9, 3);
      } else {
        ctx.fillStyle = PALETTE.outline;
        ctx.fillRect(x - 7, y - 7, 14, 14);
        ctx.fillStyle = PALETTE.blue;
        ctx.fillRect(x - 6, y - 6, 12, 12);
        ctx.fillStyle = PALETTE.white;
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    // Batched by colour: one fillStyle change per colour instead of per particle.
    const buckets = this.colorBuckets;
    buckets.clear();
    for (let i = 0; i < this.partPool.count; i++) {
      const p = this.partPool.items[i]!;
      let list = buckets.get(p.color);
      if (!list) { list = []; buckets.set(p.color, list); }
      list.push(Math.round(p.x), Math.round(p.y), p.size, clamp(p.life / p.max, 0, 1));
    }
    for (const [color, list] of buckets) {
      ctx.fillStyle = color;
      for (let i = 0; i < list.length; i += 4) {
        ctx.globalAlpha = list[i + 3]!;
        ctx.fillRect(list[i]!, list[i + 1]!, list[i + 2]!, list[i + 2]!);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawTexts(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = "center";
    for (const t of this.texts) {
      ctx.globalAlpha = clamp(t.life / 0.8, 0, 1);
      ctx.font = `${t.size}px 'Press Start 2P', monospace`;
      ctx.fillStyle = PALETTE.outline;
      ctx.fillText(t.text, Math.round(t.x) + 1, Math.round(t.y) + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, Math.round(t.x), Math.round(t.y));
    }
    ctx.globalAlpha = 1;
  }

  private drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  private drawBanner(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (this.banner.time <= 0) return;
    ctx.globalAlpha = clamp(this.banner.time, 0, 1);
    ctx.textAlign = "center";
    ctx.font = "16px 'Press Start 2P', monospace";
    ctx.fillStyle = PALETTE.outline;
    ctx.fillText(this.banner.text, w / 2 + 2, h * 0.28 + 2);
    ctx.fillStyle = PALETTE.metal3;
    ctx.fillText(this.banner.text, w / 2, h * 0.28);
    ctx.globalAlpha = 1;
  }

  /* ---------------- hud ---------------- */

  private pushHud() {
    const b = this.boss;
    this.onHud({
      hp: Math.max(0, Math.round(this.player.hp)),
      maxHp: Math.round(this.stats.maxHealth),
      level: this.level, xp: Math.round(this.xp), xpNeeded: this.xpNeeded,
      coins: this.coins, kills: this.roomKills, killsTarget: this.killsTarget,
      room: this.roomNumber, roomKind: this.roomKind,
      dashReady: this.player.dashCd <= 0,
      dashPct: 1 - this.player.dashCd / this.stats.dashCooldown,
      bossHp: b ? Math.max(0, Math.round(b.hp)) : 0,
      bossMaxHp: b ? b.maxHp : 0,
      bossName: b ? b.name : "",
      bossPhase: b ? b.phase : 0,
      roomCleared: this.roomCleared,
      buffs: [...this.buffs.entries()].map(([id, time]) => ({ id, time })),
      score: this.getResult().score,
      stats: { ...this.stats },
      weapons: WEAPON_ORDER.map((id, i) => ({
        id, name: WEAPONS[id].name, tier: this.weaponMods[id].tier,
        unlocked: this.unlockedWeapons.includes(id), slot: i + 1, active: this.weapon === id,
      })),
      cursedRoom: this.cursedRoom,
      modifiers: this.modifierIds,
      scoreMul: this.mods.scoreMul,
      fps: this.fps,
    });
  }
}

function prevent(e: Event) { e.preventDefault(); }
