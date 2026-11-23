import type { Settings } from "@/game/systems/SaveSystem";
import type { Difficulty } from "@/game/data/balance";

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}

const DIFFS: Difficulty[] = ["EASY", "NORMAL", "HARD"];
const QUALITY: Settings["quality"][] = ["LOW", "HIGH"];

export function SettingsMenu({ settings, onChange, onClose }: Props) {
  const muted = settings.muted;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-dungeon-ink/85 pixel-font">
      <div className="pixel-panel max-h-[92%] w-[420px] overflow-y-auto px-8 py-8">
        <h2 className="mb-6 text-center text-[14px] text-fx-gold">SETTINGS</h2>

        <div className="mb-5 flex items-center justify-between text-[8px] text-crate-2">
          <span>MASTER MUTE — PRESS M IN GAME</span>
          <button
            className={muted ? "pixel-btn" : "pixel-btn-ghost"}
            onClick={() => onChange({ ...settings, muted: !muted })}
          >
            {muted ? "MUTED" : "SOUND ON"}
          </button>
        </div>

        <label className="block text-[8px] text-crate-2">
          SFX VOLUME — {muted ? "MUTED" : `${Math.round(settings.sfx * 100)}%`}
        </label>
        <input
          type="range" min={0} max={1} step={0.05} value={settings.sfx}
          onChange={(e) => onChange({ ...settings, sfx: Number(e.target.value), muted: false })}
          className="mt-2 mb-5 w-full accent-[var(--fx-green)]"
          style={{ opacity: muted ? 0.4 : 1 }}
        />

        <label className="block text-[8px] text-crate-2">
          MUSIC VOLUME — {muted ? "MUTED" : `${Math.round(settings.music * 100)}%`}
        </label>
        <input
          type="range" min={0} max={1} step={0.05} value={settings.music}
          onChange={(e) => onChange({ ...settings, music: Number(e.target.value), muted: false })}
          className="mt-2 mb-5 w-full accent-[var(--fx-green)]"
          style={{ opacity: muted ? 0.4 : 1 }}
        />

        <div className="mb-5 flex items-center justify-between text-[8px] text-crate-2">
          <span>SCREEN SHAKE</span>
          <button className="pixel-btn-ghost" onClick={() => onChange({ ...settings, shake: !settings.shake })}>
            {settings.shake ? "ON" : "OFF"}
          </button>
        </div>

        <div className="mb-5 flex items-center justify-between text-[8px] text-crate-2">
          <span>PIXEL EFFECTS</span>
          <button className="pixel-btn-ghost" onClick={() => onChange({ ...settings, particles: !settings.particles })}>
            {settings.particles ? "ON" : "OFF"}
          </button>
        </div>

        <div className="mb-6">
          <div className="mb-2 text-[8px] text-crate-2">PERFORMANCE — LOW TRIMS EFFECTS FOR 60 FPS</div>
          <div className="flex gap-2">
            {QUALITY.map((q) => (
              <button
                key={q}
                className={settings.quality === q ? "pixel-btn" : "pixel-btn-ghost"}
                onClick={() => onChange({ ...settings, quality: q })}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <div className="mb-2 text-[8px] text-crate-2">DIFFICULTY</div>
          <div className="flex gap-2">
            {DIFFS.map((d) => (
              <button
                key={d}
                className={settings.difficulty === d ? "pixel-btn" : "pixel-btn-ghost"}
                onClick={() => onChange({ ...settings, difficulty: d })}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <button className="pixel-btn pixel-btn-hover w-full" onClick={onClose}>BACK</button>
      </div>
    </div>
  );
}
