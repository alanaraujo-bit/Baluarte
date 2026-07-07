import type { SaveData } from '../core/save';

/** Permanent upgrades bought with coins in the hangar (menu shop). */
export interface MetaDef {
  id: string;
  name: string;
  desc: string;
  max: number;
  baseCost: number;
  costGrowth: number;
  icon: string; // key into the shared icon painter table
}

export const META_DEFS: readonly MetaDef[] = [
  { id: 'hull', name: 'Casco Reforçado', desc: '+12 de vida máxima', max: 6, baseCost: 30, costGrowth: 1.7, icon: 'vital' },
  { id: 'core', name: 'Reator Central', desc: '+8% de dano', max: 6, baseCost: 40, costGrowth: 1.7, icon: 'power' },
  { id: 'thrust', name: 'Propulsão de Elite', desc: '+4% de velocidade', max: 5, baseCost: 35, costGrowth: 1.65, icon: 'thrusters' },
  { id: 'magnet', name: 'Coletor Magnético', desc: '+14% de raio de coleta', max: 5, baseCost: 30, costGrowth: 1.6, icon: 'magnet' },
  { id: 'luck', name: 'Olho Tático', desc: '+3% de chance crítica', max: 5, baseCost: 50, costGrowth: 1.75, icon: 'crit' },
  { id: 'greed', name: 'Prosperidade', desc: '+10% de moedas obtidas', max: 5, baseCost: 45, costGrowth: 1.7, icon: 'coin' },
];

export function metaLevel(save: SaveData, id: string): number {
  return save.meta[id] ?? 0;
}

export function metaCost(def: MetaDef, currentLevel: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}
