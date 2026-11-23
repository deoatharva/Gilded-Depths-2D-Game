import { MODIFIERS, resolveModifiers, type ModifierId } from "@/game/data/modifiers";
import { PixelIcon } from "./PixelIcon";

interface Props {
  selected: ModifierId[];
  onToggle: (id: ModifierId) => void;
  onStart: () => void;
  onClose: () => void;
}

export function ModifiersMenu({ selected, onToggle, onStart, onClose }: Props) {
  const scoreMul = resolveModifiers(selected).scoreMul;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-dungeon-ink/88 pixel-font">
      <div className="pixel-panel max-h-[94%] w-[min(92%,720px)] overflow-y-auto px-7 py-7">
        <h2 className="text-center text-[14px] text-fx-gold">RUN MODIFIERS</h2>
        <p className="mt-2 text-center text-[7px] text-crate-1">
          STACK CHALLENGES BEFORE YOU DESCEND — EACH ONE RAISES YOUR SCORE MULTIPLIER
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {MODIFIERS.map((m) => {
            const on = selected.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => onToggle(m.id)}
                className="flex items-start gap-3 border-3 bg-dungeon-ink/70 px-3 py-3 text-left transition-transform hover:-translate-y-[2px]"
                style={{ borderColor: on ? "var(--fx-gold)" : "var(--metal-1)" }}
              >
                <PixelIcon kind={m.icon as "sword"} size={18} />
                <span className="flex-1">
                  <span className={`block text-[8px] ${on ? "text-fx-gold" : "text-metal-3"}`}>{m.name}</span>
                  <span className="mt-1 block text-[6px] leading-[1.6] text-crate-1">{m.desc}</span>
                  <span className="mt-1 block text-[6px] text-fx-green">+{Math.round(m.score * 100)}% SCORE</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between text-[8px] text-crate-2">
          <span>SCORE MULTIPLIER</span>
          <span className="text-fx-gold">x{scoreMul.toFixed(2)}</span>
        </div>

        <div className="mt-5 flex gap-3">
          <button className="pixel-btn pixel-btn-hover flex-1" onClick={onStart}>DESCEND</button>
          <button className="pixel-btn-ghost" onClick={onClose}>BACK</button>
        </div>
      </div>
    </div>
  );
}
