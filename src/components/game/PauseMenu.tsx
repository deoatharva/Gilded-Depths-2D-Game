interface Props {
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onMenu: () => void;
}

export function PauseMenu({ onResume, onRestart, onSettings, onMenu }: Props) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-dungeon-ink/80 pixel-font">
      <div className="pixel-panel flex w-[320px] flex-col gap-3 px-8 py-8">
        <h2 className="mb-2 text-center text-[14px] text-fx-gold">PAUSED</h2>
        <button className="pixel-btn pixel-btn-hover" onClick={onResume}>RESUME</button>
        <button className="pixel-btn-ghost" onClick={onRestart}>RESTART RUN</button>
        <button className="pixel-btn-ghost" onClick={onSettings}>SETTINGS</button>
        <button className="pixel-btn-ghost" onClick={onMenu}>MAIN MENU</button>
        <p className="mt-2 text-center text-[7px] text-crate-1">ESC TO RESUME</p>
      </div>
    </div>
  );
}
