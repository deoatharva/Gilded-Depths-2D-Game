import type { HudData } from "@/game/engine/Game";
import { PixelIcon } from "./PixelIcon";

export function HUD({ hud }: { hud: HudData }) {
  const hpPct = Math.max(0, Math.min(1, hud.hp / hud.maxHp));
  const xpPct = Math.max(0, Math.min(1, hud.xp / hud.xpNeeded));

  return (
    <div className="pointer-events-none absolute inset-0 pixel-font select-none">
      {/* top-left kills */}
      <div className="absolute left-4 top-4 flex items-center gap-2 border-3 border-dungeon-ink bg-dungeon-ink/80 px-3 py-2 text-[10px] text-parchment">
        <PixelIcon kind="skull" size={16} />
        <span>
          {hud.kills} / {hud.killsTarget}
        </span>
      </div>

      {/* top-center level + xp */}
      <div className="absolute left-1/2 top-4 w-[280px] -translate-x-1/2 border-3 border-dungeon-ink bg-dungeon-ink/80 px-3 py-2">
        <div className="flex items-center justify-between text-[10px] text-fx-gold">
          <span>LV. {hud.level}</span>
          <span className="text-metal-3">ROOM {hud.room}</span>
        </div>
        <div className="pixel-bar mt-1 h-3 w-full">
          <div className="h-full bg-fx-green" style={{ width: `${xpPct * 100}%` }} />
        </div>
        <div className="mt-1 text-center text-[7px] text-crate-1">
          {hud.xp} / {hud.xpNeeded} XP
        </div>
      </div>

      {/* top-right coins */}
      <div className="absolute right-4 top-4 flex items-center gap-2 border-3 border-dungeon-ink bg-dungeon-ink/80 px-3 py-2 text-[10px] text-fx-gold">
        <PixelIcon kind="coin" size={16} />
        <span>{hud.coins}</span>
      </div>

      {/* boss bar */}
      {hud.bossMaxHp > 0 && (
        <div className="absolute left-1/2 top-24 w-[440px] -translate-x-1/2 border-3 border-dungeon-ink bg-dungeon-ink/85 px-3 py-2">
          <div className="flex justify-between text-[8px] text-fx-red">
            <span>{hud.bossName}</span>
            <span>PHASE {hud.bossPhase}</span>
          </div>
          <div className="pixel-bar mt-1 h-4 w-full">
            <div className="h-full bg-fx-red" style={{ width: `${(hud.bossHp / hud.bossMaxHp) * 100}%` }} />
          </div>
        </div>
      )}

      {/* buffs */}
      {hud.buffs.length > 0 && (
        <div className="absolute right-4 top-20 flex flex-col gap-1">
          {hud.buffs.map((b) => (
            <div key={b.id} className="flex items-center gap-2 border-3 border-dungeon-ink bg-dungeon-ink/80 px-2 py-1 text-[7px] text-fx-blue">
              <PixelIcon kind="star" size={12} />
              {b.id.toUpperCase()} {b.time.toFixed(1)}s
            </div>
          ))}
        </div>
      )}

      {/* bottom-left health */}
      <div className="absolute bottom-4 left-4 w-[260px] border-3 border-dungeon-ink bg-dungeon-ink/80 px-3 py-2">
        <div className="flex items-center gap-2 text-[10px] text-parchment">
          <PixelIcon kind="heart" size={16} />
          <span>
            {hud.hp} / {hud.maxHp}
          </span>
        </div>
        <div className="pixel-bar mt-1 h-4 w-full">
          <div className="h-full bg-fx-red transition-[width] duration-100" style={{ width: `${hpPct * 100}%` }} />
        </div>
      </div>

      {/* bottom-right dash */}
      <div className="absolute right-4 bottom-4 w-[150px] border-3 border-dungeon-ink bg-dungeon-ink/80 px-3 py-2">
        <div className="flex items-center gap-2 text-[9px]" style={{ color: hud.dashReady ? "var(--fx-green)" : "var(--crate-1)" }}>
          <PixelIcon kind="dash" size={14} />
          <span>{hud.dashReady ? "DASH READY" : "DASH..."}</span>
        </div>
        <div className="pixel-bar mt-1 h-3 w-full">
          <div className="h-full bg-fx-blue" style={{ width: `${Math.min(1, hud.dashPct) * 100}%` }} />
        </div>
      </div>

      {/* bottom-center weapon rack */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1">
        {hud.weapons.map((w) => (
          <div
            key={w.id}
            className="flex w-[104px] flex-col items-center gap-1 border-3 bg-dungeon-ink/80 px-2 py-2 text-[6px]"
            style={{
              borderColor: w.active ? "var(--fx-gold)" : "var(--dungeon-ink)",
              opacity: w.unlocked ? 1 : 0.32,
            }}
          >
            <span className={w.active ? "text-fx-gold" : "text-crate-1"}>
              {w.slot} · {w.name}
            </span>
            <span className="text-metal-3">
              {w.unlocked ? `TIER ${w.tier + 1}` : "LOCKED"}
            </span>
          </div>
        ))}
      </div>

      {/* run modifiers + perf readout */}
      <div className="absolute left-4 top-16 flex flex-col gap-1 text-[6px]">
        {hud.cursedRoom && (
          <span className="border-3 border-fx-red bg-dungeon-ink/85 px-2 py-1 text-fx-red">CURSED ROOM — DOUBLE LOOT</span>
        )}
        {hud.modifiers.length > 0 && (
          <span className="border-3 border-dungeon-ink bg-dungeon-ink/80 px-2 py-1 text-crate-1">
            {hud.modifiers.length} MODIFIER{hud.modifiers.length > 1 ? "S" : ""} · SCORE x{hud.scoreMul.toFixed(2)}
          </span>
        )}
        <span className="border-3 border-dungeon-ink bg-dungeon-ink/70 px-2 py-1 text-wood-3">{hud.fps} FPS</span>
      </div>

      {/* room cleared prompt */}
      {hud.roomCleared && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 border-3 border-fx-green bg-dungeon-ink/90 px-4 py-2 text-[10px] text-fx-green">
          ROOM CLEARED — REACH THE GATE AND PRESS E
        </div>
      )}
    </div>
  );
}
