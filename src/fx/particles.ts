import { Pool, swapRemove } from '../core/pool';
import { rand, TAU } from '../core/utils';
import { drawSprite, type Sprite } from './sprites';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size0: number; size1: number;
  drag: number;
  sprite: Sprite;
}

interface Ring {
  x: number; y: number;
  r: number; vr: number;
  life: number; maxLife: number;
  color: string;
  width: number;
}

export interface BurstOptions {
  count?: number;
  speed?: number;
  speedVar?: number;
  size?: number;
  endSize?: number;
  life?: number;
  drag?: number;
  angle?: number;
  /** Cone half-angle; defaults to full circle. */
  spread?: number;
}

const MAX_PARTICLES = 700;

/** Additive-blended glow particles + expanding shockwave rings. */
export class Particles {
  /** 1 = full effects; lowered by the performance setting. */
  quality = 1;

  private readonly pool = new Pool<Particle>(() => ({
    x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
    size0: 1, size1: 0, drag: 0, sprite: undefined as unknown as Sprite,
  }));
  private readonly active: Particle[] = [];
  private readonly rings: Ring[] = [];

  spawn(
    sprite: Sprite,
    x: number, y: number,
    vx: number, vy: number,
    life: number, size0: number, size1: number, drag = 0,
  ): void {
    if (this.active.length >= MAX_PARTICLES * this.quality) return;
    const p = this.pool.obtain();
    p.sprite = sprite;
    p.x = x; p.y = y;
    p.vx = vx; p.vy = vy;
    p.life = p.maxLife = life;
    p.size0 = size0; p.size1 = size1;
    p.drag = drag;
    this.active.push(p);
  }

  burst(sprite: Sprite, x: number, y: number, o: BurstOptions = {}): void {
    const count = Math.max(1, Math.round((o.count ?? 10) * this.quality));
    const speed = o.speed ?? 120;
    const speedVar = o.speedVar ?? 0.5;
    const spread = o.spread ?? Math.PI;
    const baseAngle = o.angle ?? 0;
    for (let i = 0; i < count; i++) {
      const a = o.spread === undefined
        ? rand(0, TAU)
        : baseAngle + rand(-spread, spread);
      const s = speed * rand(1 - speedVar, 1 + speedVar);
      this.spawn(
        sprite, x, y,
        Math.cos(a) * s, Math.sin(a) * s,
        (o.life ?? 0.5) * rand(0.7, 1.3),
        (o.size ?? 1) * rand(0.8, 1.2),
        o.endSize ?? 0.1,
        o.drag ?? 3,
      );
    }
  }

  ring(x: number, y: number, color: string, radius0 = 8, speed = 420, life = 0.45, width = 4): void {
    this.rings.push({ x, y, r: radius0, vr: speed, life, maxLife: life, color, width });
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.free(swapRemove(this.active, i));
        continue;
      }
      const d = 1 - Math.min(1, p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        swapRemove(this.rings, i);
        continue;
      }
      r.vr *= 1 - Math.min(1, 2.5 * dt);
      r.r += r.vr * dt;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.active) {
      const t = p.life / p.maxLife;
      const size = p.size1 + (p.size0 - p.size1) * t;
      drawSprite(ctx, p.sprite, p.x, p.y, 0, size, t * t);
    }
    for (const r of this.rings) {
      const t = r.life / r.maxLife;
      ctx.globalAlpha = t * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * t + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  clear(): void {
    for (const p of this.active) this.pool.free(p);
    this.active.length = 0;
    this.rings.length = 0;
  }
}
