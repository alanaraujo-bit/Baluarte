export interface Settings {
  sfx: boolean;
  music: boolean;
  haptics: boolean;
  lowFx: boolean;
}

export interface SaveData {
  v: number;
  coins: number;
  bestWave: number;
  bestScore: number;
  runs: number;
  totalKills: number;
  tutorialDone: boolean;
  meta: Record<string, number>;
  settings: Settings;
}

const KEY = 'vanguarda.save.v1';

function defaults(): SaveData {
  return {
    v: 1,
    coins: 0,
    bestWave: 0,
    bestScore: 0,
    runs: 0,
    totalKills: 0,
    tutorialDone: false,
    meta: {},
    settings: { sfx: true, music: true, haptics: true, lowFx: false },
  };
}

export class SaveSystem {
  data: SaveData = defaults();

  load(): void {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const base = defaults();
      this.data = {
        ...base,
        ...parsed,
        meta: { ...(parsed.meta ?? {}) },
        settings: { ...base.settings, ...(parsed.settings ?? {}) },
      };
    } catch {
      this.data = defaults();
    }
  }

  persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // storage full or unavailable — the game keeps running, progress is just not saved
    }
  }

  reset(): void {
    const settings = this.data.settings;
    this.data = defaults();
    this.data.settings = settings;
    this.persist();
  }
}
