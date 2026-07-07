import { dist2, TAU } from '../core/utils';
import { drawSprite, glowDot, shapeSprite, BLADE_POINTS, type Sprite } from '../fx/sprites';
import type { World } from './world';

const BLADE_ORBIT = 78;
const BLADE_HIT_COOLDOWN = 0.35;

/** Blades circling the player, damaging anything they graze. */
export class Orbitals {
  private angle = 0;
  private readonly blade: Sprite;

  constructor() {
    this.blade = shapeSprite({ radius: 11, color: '#7df3ff', points: BLADE_POINTS, fillAlpha: 0.4 });
  }

  update(dt: number, world: World): void {
    const lvl = world.stats.bladeLevel;
    if (lvl <= 0) return;
    const count = 1 + lvl;
    const speed = 2.7 + lvl * 0.3;
    this.angle = (this.angle + speed * dt) % TAU;
    const dmg = world.stats.damage * (0.55 + 0.15 * lvl);
    const p = world.player;

    for (let i = 0; i < count; i++) {
      const a = this.angle + (i / count) * TAU;
      const bx = p.x + Math.cos(a) * BLADE_ORBIT;
      const by = p.y + Math.sin(a) * BLADE_ORBIT;
      world.enemies.hash.query(bx, by, 40, (e) => {
        if (e.dead || e.bladeCd > 0) return;
        const r = e.radius + 13;
        if (dist2(bx, by, e.x, e.y) > r * r) return;
        e.bladeCd = BLADE_HIT_COOLDOWN;
        const knock = 170;
        const ka = Math.atan2(e.y - p.y, e.x - p.x);
        world.enemies.damage(e, dmg, false, Math.cos(ka) * knock, Math.sin(ka) * knock, world);
        world.audio.play('blade');
      });
    }
  }

  render(ctx: CanvasRenderingContext2D, world: World): void {
    const lvl = world.stats.bladeLevel;
    if (lvl <= 0) return;
    const count = 1 + lvl;
    const p = world.player;

    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = '#35f0ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, BLADE_ORBIT, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;

    for (let i = 0; i < count; i++) {
      const a = this.angle + (i / count) * TAU;
      const bx = p.x + Math.cos(a) * BLADE_ORBIT;
      const by = p.y + Math.sin(a) * BLADE_ORBIT;
      drawSprite(ctx, this.blade, bx, by, a + Math.PI / 2);
    }
  }
}

/** Periodic shockwave centered on the player. */
export class Nova {
  private timer = 0;
  private readonly chargeDot: Sprite;

  constructor() {
    this.chargeDot = glowDot(20, '#f368e0');
  }

  cooldown(lvl: number): number {
    return Math.max(3.2, 5.8 - 0.55 * lvl);
  }

  update(dt: number, world: World): void {
    const lvl = world.stats.novaLevel;
    if (lvl <= 0) return;
    this.timer += dt;
    const cd = this.cooldown(lvl);
    if (this.timer < cd) return;
    this.timer = 0;

    const radius = 115 + 34 * lvl;
    const dmg = world.stats.damage * (1.1 + 0.45 * lvl);
    const p = world.player;

    world.particles.ring(p.x, p.y, '#f368e0', 14, radius * 2.6, 0.5, 5);
    world.particles.ring(p.x, p.y, '#ffffff', 8, radius * 2.1, 0.35, 2.5);
    world.shake(10);
    world.audio.play('nova');

    const r2 = radius * radius;
    for (const e of world.enemies.list) {
      if (e.dead) continue;
      const d2 = dist2(p.x, p.y, e.x, e.y);
      if (d2 > r2) continue;
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      world.enemies.damage(e, dmg, false, Math.cos(a) * 320, Math.sin(a) * 320, world);
    }
  }

  render(ctx: CanvasRenderingContext2D, world: World, time: number): void {
    const lvl = world.stats.novaLevel;
    if (lvl <= 0) return;
    const cd = this.cooldown(lvl);
    const remaining = cd - this.timer;
    if (remaining < 0.45) {
      const t = 1 - remaining / 0.45;
      const p = world.player;
      ctx.globalCompositeOperation = 'lighter';
      drawSprite(ctx, this.chargeDot, p.x, p.y, 0, 0.4 + t * 1.1, t * 0.6);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}
