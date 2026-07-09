/**
 * Ship skins — each is a complete visual identity:
 * hull geometry, glow color, bullet tint, and HUD accent.
 *
 * The default skin (Aegis) is always free; the other five
 * are bought with coins in the Hangar and persist across runs.
 */

import type { ShapePoints } from '../fx/sprites';

export interface SkinDef {
  id: string;
  name: string;
  desc: string;
  /** Purchase price in coins. 0 = always free (default). */
  price: number;
  /** Ship hull shape in unit coordinates (pointing +X). */
  shape: ShapePoints;
  /** Hull glow/outline color. */
  color: string;
  /** Accent used in HUD bars and UI elements. */
  accent: string;
  /** Normal bullet tint. */
  bulletColor: string;
  /** Critical-hit bullet tint. */
  bulletCritColor: string;
  /** Bullet trail spark color. */
  sparkColor: string;
  /** Muzzle-flash color. */
  muzzleColor: string;
  /** Orbital blade color. */
  bladeColor: string;
  /** Nova pulse ring color. */
  novaColor: string;
  /** Draw a smaller echo inside the hull (adds detail). */
  innerDetail?: boolean;
  /** Whether a subtle secondary glow sits inside the shape. */
  fillAlpha?: number;
}

/** All skins available in the game. Index 0 is the default (always free). */
export const SKINS: readonly SkinDef[] = [
  // ── 0 · AEGIS — padrão, sempre disponível ──────────────────────
  {
    id: 'aegis',
    name: 'AEGIS',
    desc: 'Nave padrão. Casco equilibrado, assinatura ciano.',
    price: 0,
    shape: [
      [1.05, 0], [-0.75, 0.72], [-0.38, 0], [-0.75, -0.72],
    ],
    color: '#35f0ff',
    accent: '#35f0ff',
    bulletColor: '#35f0ff',
    bulletCritColor: '#ffc857',
    sparkColor: '#7df3ff',
    muzzleColor: '#b5faff',
    bladeColor: '#7df3ff',
    novaColor: '#f368e0',
    fillAlpha: 0.3,
  },
  // ── 1 · VULCAN — fogo / agressivo ──────────────────────────────
  {
    id: 'vulcan',
    name: 'VULCAN',
    desc: 'Asa-delta de combate. Perfil agressivo, rastro ígneo.',
    price: 450,
    shape: [
      [1.1, 0], [-0.3, 0.95], [-0.6, 0.55], [-0.45, 0],
      [-0.6, -0.55], [-0.3, -0.95],
    ],
    color: '#ff5d73',
    accent: '#ff5d73',
    bulletColor: '#ff9f43',
    bulletCritColor: '#ffe9b0',
    sparkColor: '#ff9f43',
    muzzleColor: '#ffb87a',
    bladeColor: '#ff5d73',
    novaColor: '#ff3b5c',
    innerDetail: true,
    fillAlpha: 0.25,
  },
  // ── 2 · SHARD — cristal / gélido ───────────────────────────────
  {
    id: 'shard',
    name: 'SHARD',
    desc: 'Cristal facetado. Cortante como gelo, preciso e letal.',
    price: 550,
    shape: [
      [1.15, 0], [0.1, 0.55], [-0.3, 0.25], [-0.7, 0.35],
      [-0.5, 0], [-0.7, -0.35], [-0.3, -0.25], [0.1, -0.55],
    ],
    color: '#52ffa8',
    accent: '#52ffa8',
    bulletColor: '#35f0ff',
    bulletCritColor: '#ffffff',
    sparkColor: '#7df3ff',
    muzzleColor: '#b5faff',
    bladeColor: '#52ffa8',
    novaColor: '#35f0ff',
    innerDetail: true,
    fillAlpha: 0.22,
  },
  // ── 3 · WRAITH — espectro / assimétrico ────────────────────────
  {
    id: 'wraith',
    name: 'WRAITH',
    desc: 'Espectro de batalha. Presença fantasmagórica, difícil de mirar.',
    price: 600,
    shape: [
      [1.2, 0], [-0.2, 0.65], [-0.55, 0.3], [-0.9, 0.5],
      [-0.5, 0], [-0.9, -0.5], [-0.55, -0.3], [-0.2, -0.65],
    ],
    color: '#c56cf0',
    accent: '#c56cf0',
    bulletColor: '#f368e0',
    bulletCritColor: '#ffffff',
    sparkColor: '#e0aaff',
    muzzleColor: '#d47fff',
    bladeColor: '#c56cf0',
    novaColor: '#f368e0',
    innerDetail: true,
    fillAlpha: 0.18,
  },
  // ── 4 · TITAN — pesada / dourada ───────────────────────────────
  {
    id: 'titan',
    name: 'TITAN',
    desc: 'Encouraçado dourado. Pesado, imponente, presença de comando.',
    price: 800,
    shape: [
      [0.85, 0], [-0.35, 0.65], [-0.65, 0.4], [-0.85, 0],
      [-0.65, -0.4], [-0.35, -0.65],
    ],
    color: '#ffc857',
    accent: '#ffc857',
    bulletColor: '#ffe9b0',
    bulletCritColor: '#ffffff',
    sparkColor: '#ffd77a',
    muzzleColor: '#ffeecc',
    bladeColor: '#ffc857',
    novaColor: '#ffb020',
    innerDetail: true,
    fillAlpha: 0.32,
  },
  // ── 5 · NIGHTFALL — furtiva / luxo ─────────────────────────────
  {
    id: 'nightfall',
    name: 'NIGHTFALL',
    desc: 'Lâmina furtiva. Silenciosa, mortal, para quem não precisa de holofotes.',
    price: 1200,
    shape: [
      [1.3, 0], [-0.15, 0.5], [-0.45, 0.15], [-0.65, 0.08],
      [-0.95, 0.12], [-0.7, 0], [-0.95, -0.12], [-0.65, -0.08],
      [-0.45, -0.15], [-0.15, -0.5],
    ],
    color: '#8fa3c8',
    accent: '#8fa3c8',
    bulletColor: '#eaf6ff',
    bulletCritColor: '#ffffff',
    sparkColor: '#bccce6',
    muzzleColor: '#d8e4f2',
    bladeColor: '#8fa3c8',
    novaColor: '#9fb8e0',
    innerDetail: true,
    fillAlpha: 0.15,
  },
];

/** Look up a skin by ID; returns Aegis (default) on unknown ID. */
export function skinById(id: string): SkinDef {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

/** @todo use this in a future skin-collection screen */
const PURCHASABLE_SKIN_IDS: readonly string[] = SKINS.slice(1).map((s) => s.id);
