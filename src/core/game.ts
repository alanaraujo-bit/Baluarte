import type { Input } from './input';
import type { Viewport } from './viewport';

export interface Scene {
  enter(): void;
  exit(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
}

/**
 * Root loop: requestAnimationFrame with clamped delta time, a global time
 * scale (slow motion) and hit-stop (brief freeze on heavy impacts — a large
 * part of what makes hits feel weighty).
 */
export class Game {
  readonly ctx: CanvasRenderingContext2D;
  /** Scaled game time in seconds since boot. */
  time = 0;
  timeScale = 1;

  private scene: Scene | null = null;
  private last = -1;
  private hitStopT = 0;
  private hitStopScale = 0.08;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly vp: Viewport,
    readonly input: Input,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D não suportado');
    this.ctx = ctx;
  }

  setScene(scene: Scene): void {
    this.scene?.exit();
    this.scene = scene;
    scene.enter();
  }

  hitStop(seconds: number, scale = 0.08): void {
    this.hitStopT = Math.max(this.hitStopT, seconds);
    this.hitStopScale = scale;
  }

  start(): void {
    requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    requestAnimationFrame(this.tick);
    if (this.last < 0) this.last = now;
    // Clamp to avoid physics explosions after tab switches / long frames.
    const rawDt = Math.min((now - this.last) / 1000, 1 / 20);
    this.last = now;

    let ts = this.timeScale;
    if (this.hitStopT > 0) {
      this.hitStopT -= rawDt;
      ts *= this.hitStopScale;
    }
    const dt = rawDt * ts;
    this.time += dt;

    this.input.update();
    if (this.scene) {
      this.scene.update(dt);
      this.ctx.setTransform(this.vp.dpr, 0, 0, this.vp.dpr, 0, 0);
      this.scene.render(this.ctx);
    }
  };
}
