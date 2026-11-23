import { useMemo } from "react";

interface Props {
  onStart: () => void;
  onModifiers: () => void;
  modifierCount: number;
  onContinue?: (() => void) | undefined;
  onSettings: () => void;
  onControls: () => void;
  best: { score: number; level: number; room: number; kills: number; bosses: number };
}

export function MainMenu({ onStart, onModifiers, modifierCount, onContinue, onSettings, onControls, best }: Props) {
  const embers = useMemo(
    () => Array.from({ length: 34 }, (_, i) => ({
      left: `${(i * 37) % 100}%`,
      delay: `${(i % 12) * 0.7}s`,
      dur: `${5 + (i % 5)}s`,
      size: 2 + (i % 3) * 2,
    })),
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden bg-dungeon-bg pixel-font">
      {embers.map((e, i) => (
        <span
          key={i}
          className="absolute bottom-0 bg-fx-gold"
          style={{ left: e.left, width: e.size, height: e.size, animation: `float-ember ${e.dur} linear ${e.delay} infinite` }}
        />
      ))}
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(23,23,25,0.5) 0 2px, transparent 2px 4px), repeating-linear-gradient(90deg, rgba(180,154,80,0.12) 0 32px, transparent 32px 64px)",
        }}
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-8 px-6">
        <div className="text-center">
          <h1 className="anim-title text-[clamp(1.6rem,4.5vw,3rem)] text-fx-gold">THE GILDED</h1>
          <h1 className="anim-title text-[clamp(1.6rem,4.5vw,3rem)] text-metal-2">DEPTHS</h1>
          <p className="mt-4 text-[9px] text-crate-1">A TOP-DOWN PIXEL SURVIVAL RUN — 15 ROOMS, 3 BOSSES</p>
        </div>

        <div className="flex flex-col gap-3">
          <button className="pixel-btn pixel-btn-hover" onClick={onStart}>START GAME</button>
          <button className="pixel-btn pixel-btn-hover" onClick={onContinue} disabled={!onContinue} style={onContinue ? undefined : { opacity: 0.45, cursor: "not-allowed" }}>
            CONTINUE RUN
          </button>
          <button className="pixel-btn-ghost" onClick={onModifiers}>
            RUN MODIFIERS{modifierCount > 0 ? ` (${modifierCount})` : ""}
          </button>
          <button className="pixel-btn-ghost" onClick={onControls}>CONTROLS</button>
          <button className="pixel-btn-ghost" onClick={onSettings}>SETTINGS</button>
        </div>

        <div className="pixel-panel px-6 py-4 text-[8px] text-crate-2">
          <div className="mb-2 text-fx-gold">HALL OF RECORDS</div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            <span>BEST SCORE</span><span className="text-metal-3">{best.score}</span>
            <span>BEST LEVEL</span><span className="text-metal-3">{best.level}</span>
            <span>DEEPEST ROOM</span><span className="text-metal-3">{best.room}</span>
            <span>TOTAL KILLS</span><span className="text-metal-3">{best.kills}</span>
            <span>BOSSES SLAIN</span><span className="text-metal-3">{best.bosses}</span>
          </div>
        </div>
        <p className="text-[7px] text-wood-3">DESKTOP ONLY — KEYBOARD + MOUSE</p>
      </div>
    </div>
  );
}
