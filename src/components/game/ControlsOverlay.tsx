const ROWS: [string, string][] = [
  ["W A S D", "MOVE"],
  ["MOUSE", "AIM"],
  ["LEFT CLICK", "ATTACK (HOLD)"],
  ["SPACE", "DASH"],
  ["E", "INTERACT / GATE"],
  ["ESC", "PAUSE"],
];

export function ControlsOverlay({ onClose, dismissible = true }: { onClose: () => void; dismissible?: boolean }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-dungeon-ink/85 pixel-font">
      <div className="pixel-panel w-[360px] px-8 py-8">
        <h2 className="mb-6 text-center text-[13px] text-fx-gold">CONTROLS</h2>
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-[8px]">
          {ROWS.map(([k, v]) => (
            <div key={k} className="contents">
              <span className="border-3 border-dungeon-ink bg-metal-2 px-2 py-1 text-dungeon-ink">{k}</span>
              <span className="self-center text-crate-2">{v}</span>
            </div>
          ))}
        </div>
        <button className="pixel-btn pixel-btn-hover mt-7 w-full" onClick={onClose}>
          {dismissible ? "GOT IT" : "BACK"}
        </button>
      </div>
    </div>
  );
}
