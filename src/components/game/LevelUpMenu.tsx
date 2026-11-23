import type { Upgrade } from "@/game/data/upgrades";
import { PixelIcon } from "./PixelIcon";

interface Props { level: number; upgrades: Upgrade[]; onPick: (u: Upgrade) => void }

export function LevelUpMenu({ level, upgrades, onPick }: Props) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-dungeon-ink/80 pixel-font">
      <div className="anim-pop text-center">
        <div className="text-[clamp(1.2rem,3vw,2rem)] text-fx-green">LEVEL UP!</div>
        <div className="mt-2 text-[14px] text-fx-gold">LV. {level}</div>
        <div className="mt-3 text-[8px] text-fx-red">THE DEPTHS GROW STRONGER TOO</div>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        {upgrades.map((u) => (
          <button
            key={u.id}
            onClick={() => onPick(u)}
            className="pixel-panel anim-pop w-[190px] px-4 py-5 text-left transition-transform hover:-translate-y-1"
          >
            <PixelIcon kind={u.icon as "sword"} size={24} />
            <div className="mt-3 text-[9px] text-metal-3">{u.title}</div>
            <div className="mt-2 text-[7px] text-crate-1">{u.desc}</div>
          </button>
        ))}
      </div>
      <p className="text-[7px] text-crate-1">CHOOSE ONE UPGRADE TO CONTINUE</p>
    </div>
  );
}
