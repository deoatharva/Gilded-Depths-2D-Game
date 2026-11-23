import type { Difficulty } from "../data/balance";
import type { ModifierId } from "../data/modifiers";

export interface Settings {
  sfx: number;
  music: number;
  muted: boolean;
  shake: boolean;
  particles: boolean;
  /** LOW trims particle budgets and effects for weaker machines */
  quality: "LOW" | "HIGH";
  difficulty: Difficulty;
}

export interface SaveData {
  bestScore: number;
  bestLevel: number;
  bestRoom: number;
  totalKills: number;
  totalBosses: number;
  settings: Settings;
  modifiers: ModifierId[];
}

const KEY = "gilded-depths-save-v1";

export const DEFAULT_SETTINGS: Settings = {
  sfx: 0.6,
  music: 0.3,
  muted: false,
  shake: true,
  particles: true,
  quality: "HIGH",
  difficulty: "NORMAL",
};

export const DEFAULT_SAVE: SaveData = {
  bestScore: 0,
  bestLevel: 1,
  bestRoom: 0,
  totalKills: 0,
  totalBosses: 0,
  settings: DEFAULT_SETTINGS,
  modifiers: [],
};

export function loadSave(): SaveData {
  if (typeof window === "undefined") return { ...DEFAULT_SAVE, settings: { ...DEFAULT_SETTINGS }, modifiers: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SAVE, settings: { ...DEFAULT_SETTINGS }, modifiers: [] };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...DEFAULT_SAVE,
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      modifiers: parsed.modifiers ?? [],
    };
  } catch {
    return { ...DEFAULT_SAVE, settings: { ...DEFAULT_SETTINGS }, modifiers: [] };
  }
}

export function saveSave(data: SaveData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}
