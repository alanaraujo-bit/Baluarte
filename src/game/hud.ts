import type { Viewport } from '../core/viewport';
import { clamp, fmtTime, roundRectPath } from '../core/utils';
import { BAL } from './balance';

export interface HudView {
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpNeed: number;
  wave: number;
  runTime: number;
  coins: number;
  combo: number;
  boss: { hp: number; maxHp: number } | null;
}

const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
const MARGIN = 12;

export class Hud {
  private lastCombo = 0;
  private comboPop = 0;
  private lastTime = 0;
  private redVignette: HTMLCanvasElement | null = null;
  private redKey = '';

  render(ctx: CanvasRenderingContext2D, v: HudView, vp: Viewport, time: number): void {
    const dt = clamp(time - this.lastTime, 0, 0.1);
    this.lastTime = time;
    const w = vp.w;
    const top = vp.safeTop;

    // Low HP warning underlay.
    const hpRatio = v.maxHp > 0 ? v.hp / v.maxHp : 0;
    if (hpRatio < 0.35 && v.hp > 0) {
      const pulse = 0.5 + Math.sin(time * 6) * 0.5;
      this.drawRedVignette(ctx, vp.w, vp.h, (0.35 - hpRatio) * 1.6 * (0.4 + 0.6 * pulse));
    }

    // XP bar across the very top.
    const xpY = top + 8;
    this.bar(ctx, MARGIN, xpY, w - MARGIN * 2, 5, 3, 'rgba(255,255,255,0.09)');
    const xpRatio = clamp(v.xp / v.xpNeed, 0, 1);
    if (xpRatio > 0.01) {
      const g = ctx.createLinearGradient(MARGIN, 0, w - MARGIN, 0);
      g.addColorStop(0, '#35f0ff');
      g.addColorStop(1, '#52ffa8');
      this.bar(ctx, MARGIN, xpY, (w - MARGIN * 2) * xpRatio, 5, 3, g);
    }

    const rowY = top + 22;

    // HP bar.
    const hpW = 138;
    this.bar(ctx, MARGIN, rowY, hpW, 16, 8, 'rgba(6,10,24,0.72)');
    if (hpRatio > 0) {
      const color = hpRatio < 0.35 ? '#ff3b5c' : '#52ffa8';
      this.bar(ctx, MARGIN + 2, rowY + 2, (hpW - 4) * hpRatio, 12, 6, color, 0.9);
    }
    ctx.font = `700 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(2,8,16,0.9)';
    ctx.fillText(`${Math.ceil(v.hp)}`, MARGIN + hpW / 2, rowY + 8.5);
    ctx.fillStyle = '#eaf6ff';

    // Level chip, tucked under the HP bar.
    ctx.font = `800 11px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7df3ff';
    ctx.fillText(`NV ${v.level}`, MARGIN + 2, rowY + 30);

    // Wave pill, centered.
    const waveText = `ONDA ${v.wave}`;
    ctx.font = `800 13px ${FONT}`;
    const tw = ctx.measureText(waveText).width;
    const pillW = tw + 26;
    this.bar(ctx, w / 2 - pillW / 2, rowY - 2, pillW, 21, 10, 'rgba(6,10,24,0.72)');
    ctx.strokeStyle = 'rgba(53,240,255,0.35)';
    ctx.lineWidth = 1;
    roundRectPath(ctx, w / 2 - pillW / 2, rowY - 2, pillW, 21, 10);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eaf6ff';
    ctx.fillText(waveText, w / 2, rowY + 9);

    // Timer + coins on the right, clear of the pause button.
    const right = w - MARGIN - 54;
    ctx.textAlign = 'right';
    ctx.font = `700 14px ${FONT}`;
    ctx.fillStyle = '#eaf6ff';
    ctx.fillText(fmtTime(v.runTime), right, rowY + 6);
    ctx.font = `800 12px ${FONT}`;
    ctx.fillStyle = '#ffc857';
    const coinText = `${v.coins}`;
    ctx.fillText(coinText, right, rowY + 24);
    const ctw = ctx.measureText(coinText).width;
    ctx.beginPath();
    ctx.arc(right - ctw - 9, rowY + 24, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffc857';
    ctx.fill();

    // Combo counter.
    if (v.combo > this.lastCombo) this.comboPop = 1;
    this.lastCombo = v.combo;
    this.comboPop = Math.max(0, this.comboPop - dt * 5);
    if (v.combo >= BAL.combo.showFrom) {
      const size = 17 + this.comboPop * 7;
      ctx.font = `900 ${size.toFixed(0)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ffc857';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffc857';
      ctx.fillText(`x${v.combo}`, w / 2, rowY + 42);
      ctx.shadowBlur = 0;
    }

    // Boss health.
    if (v.boss) {
      const bw = Math.min(300, w - MARGIN * 2);
      const bx = w / 2 - bw / 2;
      const by = rowY + 70;
      ctx.font = `800 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff9eb5';
      ctx.fillText('C O L O S S O   D A   R U Í N A', w / 2, by - 7);
      this.bar(ctx, bx, by, bw, 8, 4, 'rgba(6,10,24,0.72)');
      const ratio = clamp(v.boss.hp / v.boss.maxHp, 0, 1);
      this.bar(ctx, bx + 1, by + 1, (bw - 2) * ratio, 6, 3, '#ff2e63', 0.95);
    }
  }

  private bar(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number,
    fill: string | CanvasGradient, alpha = 1,
  ): void {
    if (w <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawRedVignette(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number): void {
    const key = `${w}x${h}`;
    if (this.redKey !== key) {
      this.redKey = key;
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w / 4));
      c.height = Math.max(1, Math.round(h / 4));
      const vctx = c.getContext('2d');
      if (vctx) {
        const r = Math.hypot(c.width, c.height) / 2;
        const g = vctx.createRadialGradient(c.width / 2, c.height / 2, r * 0.4, c.width / 2, c.height / 2, r);
        g.addColorStop(0, 'rgba(255,30,60,0)');
        g.addColorStop(1, 'rgba(255,30,60,0.85)');
        vctx.fillStyle = g;
        vctx.fillRect(0, 0, c.width, c.height);
      }
      this.redVignette = c;
    }
    if (this.redVignette) {
      ctx.globalAlpha = clamp(alpha, 0, 0.8);
      ctx.drawImage(this.redVignette, 0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }
}
