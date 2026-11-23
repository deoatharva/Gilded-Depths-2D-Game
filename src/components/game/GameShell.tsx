import { useCallback, useEffect, useRef, useState } from "react";
import { Game, type GameState, type HudData, type RunResult } from "@/game/engine/Game";
import type { Upgrade } from "@/game/data/upgrades";
import type { ModifierId } from "@/game/data/modifiers";
import { DEFAULT_SETTINGS, loadSave, saveSave, type SaveData, type Settings } from "@/game/systems/SaveSystem";
import { applyAudioSettings, playSound } from "@/game/systems/Audio";
import { HUD } from "./HUD";
import { MainMenu } from "./MainMenu";
import { PauseMenu } from "./PauseMenu";
import { LevelUpMenu } from "./LevelUpMenu";
import { SettingsMenu } from "./SettingsMenu";
import { ModifiersMenu } from "./ModifiersMenu";
import { ControlsOverlay } from "./ControlsOverlay";
import { GameOver } from "./GameOver";

const VIEW_W = 960;
const VIEW_H = 600;

type Screen = "menu" | "game";

export function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);

  const [screen, setScreen] = useState<Screen>("menu");
  const [state, setState] = useState<GameState>("playing");
  const [hud, setHud] = useState<HudData | null>(null);
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showModifiers, setShowModifiers] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [intro, setIntro] = useState(false);
  const [save, setSave] = useState<SaveData>({ ...loadSave() });
  const [runActive, setRunActive] = useState(false);

  const settings = save.settings;
  const modifiers = save.modifiers ?? [];

  useEffect(() => { applyAudioSettings(settings); }, [settings]);

  const persist = useCallback((next: SaveData) => {
    setSave(next);
    saveSave(next);
  }, []);

  const updateSettings = useCallback(
    (s: Settings) => {
      persist({ ...save, settings: s });
      gameRef.current?.updateSettings(s);
    },
    [persist, save],
  );

  const finishRun = useCallback(
    (r: RunResult, victory: boolean) => {
      setResult(r);
      setRunActive(false);
      const cur = loadSave();
      persist({
        ...cur,
        settings,
        modifiers,
        bestScore: Math.max(cur.bestScore, r.score),
        bestLevel: Math.max(cur.bestLevel, r.level),
        bestRoom: Math.max(cur.bestRoom, r.rooms),
        totalKills: cur.totalKills + r.kills,
        totalBosses: cur.totalBosses + r.bosses,
      });
      void victory;
    },
    [persist, settings, modifiers],
  );

  const destroyGame = useCallback(() => {
    gameRef.current?.destroy();
    gameRef.current = null;
  }, []);

  const bootGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    destroyGame();
    const g = new Game(canvas, settings, modifiers);
    g.onHud = setHud;
    g.onMuteToggle = (muted) => {
      const cur = loadSave();
      persist({ ...cur, settings: { ...cur.settings, muted } });
    };
    g.onStateChange = (s) => {
      setState(s);
      if (s === "levelup") setUpgrades(g.pendingUpgrades);
    };
    g.onRunEnd = (r) => finishRun(r, g.state === "victory");
    gameRef.current = g;
    g.start();
    setState("playing");
    setResult(null);
    setRunActive(true);
    setIntro(true);
    window.setTimeout(() => setIntro(false), 4200);
  }, [destroyGame, finishRun, persist, settings, modifiers]);

  useEffect(() => destroyGame, [destroyGame]);

  const startGame = () => {
    playSound("ui");
    setShowModifiers(false);
    setScreen("game");
    window.setTimeout(bootGame, 0);
  };

  const toggleModifier = (id: ModifierId) => {
    playSound("ui");
    const next = modifiers.includes(id) ? modifiers.filter((m) => m !== id) : [...modifiers, id];
    persist({ ...save, modifiers: next });
  };

  const continueRun = () => {
    playSound("ui");
    setScreen("game");
  };

  const toMenu = () => {
    playSound("ui");
    setScreen("menu");
    setShowSettings(false);
  };

  const quitRun = () => {
    destroyGame();
    setRunActive(false);
    toMenu();
  };

  const pickUpgrade = (u: Upgrade) => {
    playSound("ui");
    gameRef.current?.applyUpgrade(u);
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-dungeon-ink p-4">
      <div
        className="relative overflow-hidden border-4 border-dungeon-ink bg-dungeon-bg shadow-[0_0_0_6px_var(--metal-1),0_0_60px_rgba(0,0,0,0.8)]"
        style={{ width: "min(96vw, 1100px)", aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
      >
        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          className="pixelated block h-full w-full cursor-crosshair"
          style={{ display: screen === "game" ? "block" : "none" }}
        />

        {screen === "game" && hud && state !== "gameover" && state !== "victory" && <HUD hud={hud} />}

        {screen === "game" && intro && state === "playing" && (
          <div className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 border-3 border-metal-1 bg-dungeon-ink/85 px-5 py-3 pixel-font text-[8px] text-crate-2">
            <span className="text-metal-3">WASD</span> MOVE &nbsp;·&nbsp; <span className="text-metal-3">MOUSE</span> AIM &nbsp;·&nbsp;{" "}
            <span className="text-metal-3">LEFT CLICK</span> ATTACK &nbsp;·&nbsp; <span className="text-metal-3">SPACE</span> DASH &nbsp;·&nbsp;{" "}
            <span className="text-metal-3">E</span> INTERACT
          </div>
        )}

        {screen === "game" && state === "levelup" && hud && (
          <LevelUpMenu level={hud.level} upgrades={upgrades} onPick={pickUpgrade} />
        )}

        {screen === "game" && state === "paused" && !showSettings && (
          <PauseMenu
            onResume={() => gameRef.current?.resume()}
            onRestart={() => { playSound("ui"); bootGame(); }}
            onSettings={() => setShowSettings(true)}
            onMenu={quitRun}
          />
        )}

        {screen === "game" && (state === "gameover" || state === "victory") && result && (
          <GameOver
            result={result}
            best={{ score: save.bestScore, level: save.bestLevel }}
            victory={state === "victory"}
            onRestart={bootGame}
            onMenu={quitRun}
          />
        )}

        {screen === "menu" && (
          <MainMenu
            onStart={startGame}
            onModifiers={() => { playSound("ui"); setShowModifiers(true); }}
            modifierCount={modifiers.length}
            onContinue={runActive ? continueRun : undefined}
            onSettings={() => setShowSettings(true)}
            onControls={() => setShowControls(true)}
            best={{ score: save.bestScore, level: save.bestLevel, room: save.bestRoom, kills: save.totalKills, bosses: save.totalBosses }}
          />
        )}

        {screen === "menu" && showModifiers && (
          <ModifiersMenu
            selected={modifiers}
            onToggle={toggleModifier}
            onStart={startGame}
            onClose={() => setShowModifiers(false)}
          />
        )}

        {showSettings && (
          <SettingsMenu
            settings={settings ?? DEFAULT_SETTINGS}
            onChange={updateSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
        {showControls && <ControlsOverlay dismissible={false} onClose={() => setShowControls(false)} />}
      </div>

      <p className="mt-3 pixel-font text-[7px] text-wood-3">
        THE GILDED DEPTHS — WASD MOVE · MOUSE AIM · CLICK ATTACK · SPACE DASH · E INTERACT · ESC PAUSE
      </p>
    </div>
  );
}
