import { Pool, swapRemove } from '../core/pool';

interface Floater {
  x: number; y: number;
  vy: number;
  life: number; maxLife: number;
  text: string;
  color: string;
  size: number;
  bold: boolean;
}

export interface FloaterOptions {
  color?: string;
  size?: number;
  life?: number;
  vy?: number;
  bold?: boolean;
}

const FONT_STACK = '"Segoe UI", system-ui, -apple-system, sans-serif';
const MAX_FLOATERS = 80;

/** Floating world-space text: damage numbers, coin gains, headlines. */
export class Floaters {
  private readonly pool = new Pool<Floater>(() => ({
    x: 0, y: 0, vy: 0, life: 0, maxLife: 1, text: '', color: '#fff', size: 13, bold: false,
  }));
  private readonly active: Floater[] = [];
  /** Cap efetivo, escalado pelo setting de densidade de entidades. */
  private maxFloaters = MAX_FLOATERS;

  /** Setting de gráficos (densidade de entidades). */
  setDensity(mul: number): void {
    this.maxFloaters = Math.round(MAX_FLOATERS * mul);
  }

  spawn(x: number, y: number, text: string, o: FloaterOptions = {}): void {
    if (this.active.length >= this.maxFloaters) return;
    const f = this.pool.obtain();
    f.x = x + (Math.random() - 0.5) * 10;
    f.y = y;
    f.vy = o.vy ?? -52;
    f.life = f.maxLife = o.life ?? 0.7;
    f.text = text;
    f.color = o.color ?? '#ffffff';
    f.size = o.size ?? 13;
    f.bold = o.bold ?? false;
    this.active.push(f);
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const f = this.active[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.pool.free(swapRemove(this.active, i));
        continue;
      }
      f.y += f.vy * dt;
      f.vy *= 1 - Math.min(1, 3 * dt);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.active) {
      const t = f.life / f.maxLife;
      // Quick pop-in scale at birth, fade-out at death.
      const born = 1 - t;
      const scale = born < 0.15 ? 0.6 + (born / 0.15) * 0.4 : 1;
      ctx.globalAlpha = Math.min(1, t * 3);
      ctx.font = `${f.bold ? '800' : '700'} ${Math.round(f.size * scale)}px ${FONT_STACK}`;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    for (const f of this.active) this.pool.free(f);
    this.active.length = 0;
  }
}
