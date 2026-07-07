/**
 * Owns canvas sizing: CSS pixels as the logical coordinate system, scaled by
 * a capped devicePixelRatio for crispness without melting phone GPUs.
 * Also measures iOS/Android safe-area insets so the HUD can respect notches.
 */
export class Viewport {
  w = 0;
  h = 0;
  dpr = 1;
  safeTop = 0;
  safeBottom = 0;

  private readonly probe: HTMLDivElement;
  private readonly listeners: Array<() => void> = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.probe = document.createElement('div');
    this.probe.style.cssText =
      'position:fixed;inset:0;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);';
    document.body.appendChild(this.probe);

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.resize();
    });
    this.resize();
    // Some mobile browsers report env(safe-area-inset-*) as 0 for the first
    // frame or two after a cold PWA launch, before settling on the real
    // value. Re-measure for a bit so a late-arriving inset still applies.
    this.settleSafeArea();
  }

  private settleSafeArea(triesLeft = 10): void {
    if (triesLeft <= 0) return;
    requestAnimationFrame(() => {
      this.resize();
      this.settleSafeArea(triesLeft - 1);
    });
  }

  onResize(fn: () => void): void {
    this.listeners.push(fn);
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;

    const style = getComputedStyle(this.probe);
    this.safeTop = parseFloat(style.paddingTop) || 0;
    this.safeBottom = parseFloat(style.paddingBottom) || 0;

    for (const fn of this.listeners) fn();
  }
}
