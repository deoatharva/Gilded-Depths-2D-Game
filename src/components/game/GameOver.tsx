import type { RunResult } from "@/game/engine/Game";

interface Props {
  result: RunResult;
  best: { score: number; level: number };
  victory: boolean;
  onRestart: () => void;
  onMenu: () => void;
}

export function GameOver({ result, best, victory, onRestart, onMenu }: Props) {
  const rows: [string, string | number][] = [
    ["FINAL LEVEL", result.level],
    ["ROOMS CLEARED", result.rooms],
    ["ENEMIES DEFEATED", result.kills],
    ["BOSSES SLAIN", result.bosses],
    ["COINS COLLECTED", result.coins],
    ["DAMAGE DEALT", result.damage],
    ["TIME SURVIVED", `${result.time}s`],
    ["SCORE", result.score],
    ["BEST SCORE", best.score],
    ["BEST LEVEL", best.level],
  ];

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-dungeon-ink/90 pixel-font">
      <div className="pixel-panel anim-pop w-[420px] px-9 py-9">
        <h2 className={`mb-6 text-center text-[18px] ${victory ? "text-fx-gold anim-title" : "text-fx-red"}`}>
          {victory ? "VICTORY!" : "GAME OVER"}
        </h2>
        <div className="grid grid-cols-2 gap-y-2 text-[8px] text-crate-2">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <span>{k}</span>
              <span className="text-right text-metal-3">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-7 flex flex-col gap-3">
          <button className="pixel-btn pixel-btn-hover" onClick={onRestart}>{victory ? "PLAY AGAIN" : "RESTART"}</button>
          <button className="pixel-btn-ghost" onClick={onMenu}>MAIN MENU</button>
        </div>
      </div>
    </div>
  );
}
