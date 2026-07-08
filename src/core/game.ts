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
  /** Setting gráfico de limite de quadros. 0 = sem limite. */
  fpsCap: 0 | 30 | 60 = 0;
  /** Quadros por segundo medidos, atualizado ~2x/s (só pro contador de FPS). */
  fps = 0;

  private scene: Scene | null = null;
  private last = -1;
  private hitStopT = 0;
  private hitStopScale = 0.08;
  private fpsFrames = 0;
  private fpsAccum = 0;

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
    const elapsed = now - this.last;
    // Limite de FPS: pula o frame inteiro (update + colisão + render) se
    // chegou cedo demais — é aí que está o custo de CPU de verdade, não dá
    // pra "renderizar mais devagar" dentro do mesmo frame do rAF.
    if (this.fpsCap > 0 && elapsed < 1000 / this.fpsCap - 0.5) return;
    // Clamp to avoid physics explosions after tab switches / long frames.
    const rawDt = Math.min(elapsed / 1000, 1 / 20);
    this.last = now;

    this.fpsFrames++;
    this.fpsAccum += elapsed;
    if (this.fpsAccum >= 500) {
      this.fps = Math.round((this.fpsFrames * 1000) / this.fpsAccum);
      this.fpsFrames = 0;
      this.fpsAccum = 0;
    }

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
