import type { Input } from '../core/input';
import type { AudioEngine } from '../audio/audio';
import type { Particles } from '../fx/particles';
import type { Floaters } from '../fx/floaters';
import type { Stats } from './upgrades';
import type { Player } from './player';
import type { Enemies, Enemy } from './enemies';
import type { PlayerShots, EnemyShots } from './projectiles';
import type { Pickups } from './pickups';

/**
 * The run's shared context. Every gameplay system receives this instead of
 * importing concrete siblings, which keeps the dependency graph a star
 * (GameScene at the center) instead of a web.
 */
export interface World {
  time: number;
  runTime: number;
  stats: Stats;
  input: Input;
  player: Player;
  enemies: Enemies;
  playerShots: PlayerShots;
  enemyShots: EnemyShots;
  pickups: Pickups;
  particles: Particles;
  floaters: Floaters;
  audio: AudioEngine;

  /** A random point just outside the visible screen, in world coordinates. */
  randomSpawnPos(): [number, number];
  shake(amount: number): void;
  hitStop(seconds: number, scale?: number): void;
  onEnemyKilled(e: Enemy): void;
  onBossDefeated(e: Enemy): void;
  onGemCollected(value: number): void;
  onCoinCollected(value: number): void;
  onPlayerDeath(): void;
}
