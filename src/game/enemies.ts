import { Pool, swapRemove } from '../core/pool';
import { chance, clamp, damp, dist2, len, rand, randInt, TAU } from '../core/utils';
import { drawSprite, glowDot, shapeSprite, DART_POINTS, type Sprite } from '../fx/sprites';
import { BAL } from './balance';
import type { World } from './world';

export type EnemyKind = 'drone' | 'dart' | 'splitter' | 'mini' | 'wasp' | 'tank' | 'boss';

interface Spec {
  hp: number;
  speed: number;
  dmg: number;
  radius: number;
  xp: number;
  score: number;
  color: string;
}

const SPECS: Record<EnemyKind, Spec> = {
  drone:    { hp: 18,  speed: 64,  dmg: 8,  radius: 12, xp: 1, score: 10,  color: '#ff4d6d' },
  dart:     { hp: 9,   speed: 132, dmg: 6,  radius: 9,  xp: 1, score: 15,  color: '#ff9f43' },
  splitter: { hp: 36,  speed: 46,  dmg: 10, radius: 15, xp: 2, score: 25,  color: '#c56cf0' },
  mini:     { hp: 8,   speed: 100, dmg: 5,  radius: 8,  xp: 1, score: 8,   color: '#c56cf0' },
  wasp:     { hp: 26,  speed: 74,  dmg: 8,  radius: 11, xp: 2, score: 30,  color: '#f368e0' },
  tank:     { hp: 115, speed: 30,  dmg: 18, radius: 22, xp: 4, score: 50,  color: '#ff3838' },
  boss:     { hp: 520, speed: 58,  dmg: 24, radius: 42, xp: 25, score: 500, color: '#ff2e63' },
};

// Boss phases
const P_CHASE = 0;
const P_VOLLEY = 1;
const P_TELEGRAPH = 2;
const P_DASH = 3;

export class Enemy {
  kind: EnemyKind = 'drone';
  x = 0; y = 0;
  vx = 0; vy = 0;
  /** Knockback velocity, decays independently of steering. */
  kvx = 0; kvy = 0;
  hp = 1; maxHp = 1;
  radius = 10;
  dmg = 5;
  speed = 50;
  xp = 1;
  score = 10;
  rot = 0;
  t = 0;
  flash = 0;
  bladeCd = 0;
  fireT = 0;
  seed = 0;
  phase = P_CHASE;
  phaseT = 0;
  volleys = 0;
  dead = false;
}

/**
 * Uniform grid with wrap-around hashing and lazily-cleared stamped buckets:
 * zero per-frame allocation. False positives from wrapping are filtered by
 * the exact distance checks all callers already do.
 */
class SpatialHash {
  private readonly cell = 72;
  private readonly buckets: Enemy[][] = [];
  private readonly stamps = new Int32Array(4096);
  private frame = 0;

  constructor() {
    for (let i = 0; i < 4096; i++) this.buckets.push([]);
  }

  begin(): void {
    this.frame++;
  }

  insert(e: Enemy): void {
    const i = this.index(Math.floor(e.x / this.cell), Math.floor(e.y / this.cell));
    if (this.stamps[i] !== this.frame) {
      this.stamps[i] = this.frame;
      this.buckets[i].length = 0;
    }
    this.buckets[i].push(e);
  }

  query(x: number, y: number, r: number, cb: (e: Enemy) => void): void {
    const pad = r + 48; // max enemy radius, since entities are inserted by center
    const x0 = Math.floor((x - pad) / this.cell);
    const x1 = Math.floor((x + pad) / this.cell);
    const y0 = Math.floor((y - pad) / this.cell);
    const y1 = Math.floor((y + pad) / this.cell);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const i = this.index(cx, cy);
        if (this.stamps[i] !== this.frame) continue;
        const bucket = this.buckets[i];
        for (let k = 0; k < bucket.length; k++) cb(bucket[k]);
      }
    }
  }

  private index(cx: number, cy: number): number {
    return ((cx & 63) << 6) | (cy & 63);
  }
}

interface AoeEvent { x: number; y: number; r: number; dmg: number; }
interface SpawnEvent { kind: EnemyKind; x: number; y: number; hpMul: number; dmgMul: number; }

export class Enemies {
  readonly list: Enemy[] = [];
  readonly hash = new SpatialHash();
  boss: Enemy | null = null;

  private readonly pool = new Pool<Enemy>(() => new Enemy());
  private readonly sprites = new Map<EnemyKind, Sprite>();
  private readonly flashes = new Map<EnemyKind, Sprite>();
  private readonly debris = new Map<EnemyKind, Sprite>();
  private readonly pendingAoe: AoeEvent[] = [];
  private readonly pendingSpawn: SpawnEvent[] = [];

  constructor() {
    const shapes: Record<EnemyKind, () => [Sprite, Sprite]> = {
      drone: () => this.bake('drone', { sides: 3 }),
      dart: () => this.bake('dart', { points: DART_POINTS }),
      splitter: () => this.bake('splitter', { sides: 4, rotate: Math.PI / 4, innerDetail: true }),
      mini: () => this.bake('mini', { sides: 3 }),
      wasp: () => this.bake('wasp', { sides: 4 }),
      tank: () => this.bake('tank', { sides: 6, innerDetail: true }),
      boss: () => this.bake('boss', { sides: 8, innerDetail: true }),
    };
    (Object.keys(shapes) as EnemyKind[]).forEach((kind) => {
      const [normal, flash] = shapes[kind]();
      this.sprites.set(kind, normal);
      this.flashes.set(kind, flash);
      this.debris.set(kind, glowDot(5, SPECS[kind].color));
    });
  }

  private bake(kind: EnemyKind, opts: { sides?: number; points?: typeof DART_POINTS; rotate?: number; innerDetail?: boolean }): [Sprite, Sprite] {
    const spec = SPECS[kind];
    const base = { radius: spec.radius * 1.25, ...opts };
    return [
      shapeSprite({ ...base, color: spec.color }),
      shapeSprite({ ...base, color: '#ffffff', fillAlpha: 0.6 }),
    ];
  }

  spawn(kind: EnemyKind, x: number, y: number, hpMul: number, dmgMul: number): Enemy {
    const spec = SPECS[kind];
    const e = this.pool.obtain();
    e.kind = kind;
    e.x = x; e.y = y;
    e.vx = 0; e.vy = 0;
    e.kvx = 0; e.kvy = 0;
    e.maxHp = e.hp = spec.hp * hpMul;
    e.radius = spec.radius;
    e.dmg = spec.dmg * dmgMul;
    e.speed = spec.speed * rand(0.9, 1.1);
    e.xp = spec.xp;
    e.score = spec.score;
    e.rot = rand(0, TAU);
    e.t = 0;
    e.flash = 0;
    e.bladeCd = 0;
    e.fireT = rand(1, 2.5);
    e.seed = rand(0, TAU);
    e.phase = P_CHASE;
    e.phaseT = 0;
    e.volleys = 0;
    e.dead = false;
    this.list.push(e);
    if (kind === 'boss') this.boss = e;
    return e;
  }

  nearest(x: number, y: number, maxDist: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = maxDist * maxDist;
    for (const e of this.list) {
      if (e.dead) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  update(dt: number, world: World): void {
    const player = world.player;

    // Rebuild the spatial index (also consumed by shots/blades this frame).
    this.hash.begin();
    for (const e of this.list) {
      if (!e.dead) this.hash.insert(e);
    }

    for (const e of this.list) {
      if (e.dead) continue;
      e.t += dt;
      e.flash -= dt;
      e.bladeCd -= dt;
      this.steer(e, dt, world);

      // Knockback decays fast; movement adds steering + knockback.
      const kd = 1 - Math.min(1, 7 * dt);
      e.kvx *= kd;
      e.kvy *= kd;
      e.x += (e.vx + e.kvx) * dt;
      e.y += (e.vy + e.kvy) * dt;

      // Soft separation against neighbors.
      this.hash.query(e.x, e.y, e.radius, (other) => {
        if (other === e || other.dead) return;
        const min = e.radius + other.radius;
        const d2 = dist2(e.x, e.y, other.x, other.y);
        if (d2 >= min * min || d2 === 0) return;
        const d = Math.sqrt(d2);
        const push = ((min - d) / min) * 34 * dt;
        e.x += ((e.x - other.x) / d) * push;
        e.y += ((e.y - other.y) / d) * push;
      });

      // Contact damage.
      if (!player.dead && player.iframes <= 0) {
        const r = e.radius + player.radius;
        if (dist2(e.x, e.y, player.x, player.y) < r * r) {
          player.takeDamage(e.dmg, world);
          const a = Math.atan2(e.y - player.y, e.x - player.x);
          e.kvx += Math.cos(a) * 160;
          e.kvy += Math.sin(a) * 160;
        }
      }
    }

    // Sweep the dead.
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].dead) {
        this.pool.free(swapRemove(this.list, i));
      }
    }

    // Deferred fragmentation chains and splitter births.
    let guard = 0;
    while (this.pendingAoe.length > 0 && guard++ < 60) {
      const aoe = this.pendingAoe.shift()!;
      const r2 = aoe.r * aoe.r;
      for (const e of this.list) {
        if (e.dead) continue;
        if (dist2(aoe.x, aoe.y, e.x, e.y) > r2) continue;
        const a = Math.atan2(e.y - aoe.y, e.x - aoe.x);
        this.damage(e, aoe.dmg, false, Math.cos(a) * 180, Math.sin(a) * 180, world);
      }
    }
    this.pendingAoe.length = 0;
    for (const s of this.pendingSpawn) {
      const e = this.spawn(s.kind, s.x, s.y, s.hpMul, s.dmgMul);
      e.kvx = rand(-140, 140);
      e.kvy = rand(-140, 140);
    }
    this.pendingSpawn.length = 0;
  }

  private steer(e: Enemy, dt: number, world: World): void {
    const p = world.player;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = len(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;
    const k = damp(4, dt);

    switch (e.kind) {
      case 'drone':
      case 'mini':
        e.vx += (nx * e.speed - e.vx) * k;
        e.vy += (ny * e.speed - e.vy) * k;
        e.rot = Math.atan2(e.vy, e.vx) + Math.PI / 2;
        break;
      case 'dart': {
        const weave = Math.sin(e.t * 5 + e.seed) * 70;
        e.vx += ((nx * e.speed - ny * weave) - e.vx) * damp(6, dt);
        e.vy += ((ny * e.speed + nx * weave) - e.vy) * damp(6, dt);
        e.rot = Math.atan2(e.vy, e.vx);
        break;
      }
      case 'splitter':
        e.vx += (nx * e.speed - e.vx) * k;
        e.vy += (ny * e.speed - e.vy) * k;
        e.rot += dt * 2.4;
        break;
      case 'tank':
        e.vx += (nx * e.speed - e.vx) * damp(2, dt);
        e.vy += (ny * e.speed - e.vy) * damp(2, dt);
        e.rot += dt * 0.5;
        break;
      case 'wasp': {
        const strafe = Math.sin(e.seed) >= 0 ? 1 : -1;
        let tx = 0;
        let ty = 0;
        if (d > 210) {
          tx = nx * e.speed;
          ty = ny * e.speed;
        } else if (d < 145) {
          tx = -nx * e.speed;
          ty = -ny * e.speed;
        }
        tx += -ny * strafe * 46;
        ty += nx * strafe * 46;
        e.vx += (tx - e.vx) * damp(5, dt);
        e.vy += (ty - e.vy) * damp(5, dt);
        e.rot = Math.atan2(dy, dx) + Math.PI / 2;
        e.fireT -= dt;
        if (e.fireT <= 0 && d < 320 && !p.dead) {
          e.fireT = rand(2.1, 2.9);
          world.enemyShots.spawn(e.x, e.y, Math.atan2(dy, dx), 165, e.dmg * 0.85);
          world.audio.play('shotE');
        }
        break;
      }
      case 'boss':
        this.steerBoss(e, dt, world, nx, ny, d);
        break;
    }
  }

  private steerBoss(e: Enemy, dt: number, world: World, nx: number, ny: number, d: number): void {
    e.rot += dt * 0.7;
    e.phaseT += dt;
    const enrage = e.hp < e.maxHp * 0.35 ? 0.72 : 1;

    switch (e.phase) {
      case P_CHASE:
        e.vx += (nx * e.speed - e.vx) * damp(2.5, dt);
        e.vy += (ny * e.speed - e.vy) * damp(2.5, dt);
        if (e.phaseT > 2.6 * enrage) {
          e.phase = P_VOLLEY;
          e.phaseT = 0;
          e.volleys = 0;
        }
        break;
      case P_VOLLEY: {
        e.vx *= 1 - Math.min(1, 4 * dt);
        e.vy *= 1 - Math.min(1, 4 * dt);
        const interval = 0.55 * enrage;
        if (e.phaseT > interval) {
          e.phaseT = 0;
          e.volleys++;
          const count = 10;
          const offset = e.rot;
          for (let i = 0; i < count; i++) {
            const a = offset + (i / count) * TAU;
            world.enemyShots.spawn(e.x + Math.cos(a) * e.radius, e.y + Math.sin(a) * e.radius, a, 130, e.dmg * 0.6);
          }
          world.audio.play('shotE');
          if (e.volleys >= 3) {
            e.phase = P_TELEGRAPH;
            e.phaseT = 0;
          }
        }
        break;
      }
      case P_TELEGRAPH:
        e.vx *= 1 - Math.min(1, 6 * dt);
        e.vy *= 1 - Math.min(1, 6 * dt);
        e.flash = 0.05; // steady warning shimmer
        if (e.phaseT > 0.7 * enrage) {
          e.phase = P_DASH;
          e.phaseT = 0;
          e.vx = nx * 660;
          e.vy = ny * 660;
          world.audio.play('warn');
        }
        break;
      case P_DASH:
        if (e.phaseT > 0.5) {
          e.phase = P_CHASE;
          e.phaseT = 0;
        }
        break;
    }
  }

  damage(e: Enemy, amount: number, crit: boolean, kx: number, ky: number, world: World): void {
    if (e.dead) return;
    e.hp -= amount;
    e.flash = 0.09;
    // Heavy units and the boss resist knockback.
    const resist = e.kind === 'tank' ? 0.35 : e.kind === 'boss' ? 0.08 : 1;
    e.kvx += kx * resist;
    e.kvy += ky * resist;
    world.floaters.spawn(e.x, e.y - e.radius - 4, String(Math.round(amount)), {
      color: crit ? '#ffc857' : '#ffffff',
      size: crit ? 17 : 12,
      bold: crit,
    });
    world.audio.play('hit', crit ? 0.8 : 1.1);
    if (e.hp <= 0) this.kill(e, world);
  }

  private kill(e: Enemy, world: World): void {
    e.dead = true;
    const debris = this.debris.get(e.kind)!;
    const big = e.radius >= 18;
    world.particles.burst(debris, e.x, e.y, {
      count: big ? 18 : 9,
      speed: big ? 210 : 150,
      size: big ? 1.6 : 1.1,
      life: big ? 0.55 : 0.4,
    });
    if (big) world.particles.ring(e.x, e.y, SPECS[e.kind].color, 10, 380, 0.4, 4);
    world.audio.play(big ? 'dieBig' : 'die');
    if (big) world.shake(8);

    // Loot
    world.pickups.spawnGems(e.x, e.y, e.xp);
    if (e.kind === 'boss') {
      world.pickups.spawnCoins(e.x, e.y, randInt(BAL.drops.bossCoins[0], BAL.drops.bossCoins[1]));
      world.pickups.spawnHeart(e.x, e.y);
    } else {
      if (chance(BAL.drops.coinChance)) world.pickups.spawnCoins(e.x, e.y, e.kind === 'tank' ? 3 : 1);
      if (e.kind === 'tank' && chance(BAL.drops.heartChanceTank)) world.pickups.spawnHeart(e.x, e.y);
    }

    if (e.kind === 'splitter') {
      this.pendingSpawn.push(
        { kind: 'mini', x: e.x - 10, y: e.y, hpMul: e.maxHp / SPECS.splitter.hp, dmgMul: e.dmg / SPECS.splitter.dmg },
        { kind: 'mini', x: e.x + 10, y: e.y, hpMul: e.maxHp / SPECS.splitter.hp, dmgMul: e.dmg / SPECS.splitter.dmg },
      );
    }

    if (e === this.boss) {
      this.boss = null;
      world.onBossDefeated(e);
    }
    world.onEnemyKilled(e);
  }

  queueAoe(x: number, y: number, r: number, dmg: number): void {
    this.pendingAoe.push({ x, y, r, dmg });
  }

  render(ctx: CanvasRenderingContext2D, time: number): void {
    for (const e of this.list) {
      if (e.dead) continue;
      const sprite = this.sprites.get(e.kind)!;
      const scale = e.kind === 'boss' ? 1 + Math.sin(time * 4) * 0.04 : 1;
      drawSprite(ctx, sprite, e.x, e.y, e.rot, scale);
      if (e.flash > 0) {
        drawSprite(ctx, this.flashes.get(e.kind)!, e.x, e.y, e.rot, scale, clamp(e.flash / 0.09, 0, 1));
      }
    }
  }

  clear(): void {
    for (const e of this.list) this.pool.free(e);
    this.list.length = 0;
    this.boss = null;
    this.pendingAoe.length = 0;
    this.pendingSpawn.length = 0;
  }
}
