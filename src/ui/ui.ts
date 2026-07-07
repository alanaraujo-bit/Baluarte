import type { SaveSystem } from '../core/save';
import { fmtTime } from '../core/utils';
import type { AudioEngine } from '../audio/audio';
import { S } from '../i18n/strings';
import { META_DEFS, metaCost, metaLevel } from '../game/meta';
import { paintIcon, type UpgradeDef } from '../game/upgrades';

export interface RunStats {
  wave: number;
  kills: number;
  time: number;
  score: number;
  coins: number;
  newRecord: boolean;
}

export interface UiActions {
  startRun(): void;
  pauseRun(): void;
  resumeRun(): void;
  restartRun(): void;
  quitToMenu(): void;
  applySettings(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * DOM screen layer. Menus and modals are HTML/CSS (for typography, blur and
 * spring animations the canvas can't match); the game world stays on canvas.
 */
export class UI {
  private readonly root: HTMLElement;
  private readonly screens = new Map<string, HTMLElement>();
  private pauseBtn: HTMLElement | null = null;
  private tutorial: HTMLElement | null = null;

  constructor(
    private readonly save: SaveSystem,
    private readonly audio: AudioEngine,
    private readonly actions: UiActions,
  ) {
    const root = document.getElementById('ui');
    if (!root) throw new Error('#ui não encontrado');
    this.root = root;
  }

  // ————— infrastructure —————

  private btn(label: string, cls: string, onTap: () => void): HTMLButtonElement {
    const b = el('button', `btn ${cls}`, label);
    b.addEventListener('pointerdown', () => this.audio.play('tap'));
    b.addEventListener('click', onTap);
    return b;
  }

  private screen(name: string): HTMLElement {
    let s = this.screens.get(name);
    if (!s) {
      s = el('div', `screen s-${name}`);
      this.root.appendChild(s);
      this.screens.set(name, s);
    }
    s.innerHTML = '';
    return s;
  }

  private open(name: string): void {
    const s = this.screens.get(name);
    if (!s) return;
    requestAnimationFrame(() => requestAnimationFrame(() => s.classList.add('on')));
  }

  private close(name: string): void {
    this.screens.get(name)?.classList.remove('on');
  }

  hideAll(): void {
    for (const s of this.screens.values()) s.classList.remove('on');
  }

  private coinChip(value: number): HTMLElement {
    const chip = el('span', 'chip chip-coins');
    chip.appendChild(el('span', 'coin-dot'));
    chip.appendChild(el('span', 'chip-value', String(value)));
    return chip;
  }

  private countUp(target: HTMLElement, value: number, duration = 0.9, prefix = ''): void {
    const start = performance.now();
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      target.textContent = prefix + String(Math.round(value * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private pips(current: number, max: number, highlightNext = false): HTMLElement {
    const wrap = el('div', 'pips');
    for (let i = 0; i < max; i++) {
      const pip = el('span', 'pip');
      if (i < current) pip.classList.add('full');
      else if (highlightNext && i === current) pip.classList.add('next');
      wrap.appendChild(pip);
    }
    return wrap;
  }

  // ————— main menu —————

  showMenu(): void {
    this.hideAll();
    const s = this.screen('menu');

    s.appendChild(el('div', 'spacer'));
    s.appendChild(el('h1', 'logo', S.title));
    s.appendChild(el('div', 'tagline', S.tagline));

    const chips = el('div', 'row chips');
    const best = el('span', 'chip', `${S.bestWave}: ${this.save.data.bestWave || '—'}`);
    chips.appendChild(best);
    chips.appendChild(this.coinChip(this.save.data.coins));
    s.appendChild(chips);

    s.appendChild(el('div', 'spacer'));

    const col = el('div', 'col actions');
    col.appendChild(this.btn(S.play, 'primary big pulse', () => {
      this.audio.play('confirm');
      this.actions.startRun();
    }));
    col.appendChild(this.btn(S.upgrades, 'ghost', () => this.showShop()));
    col.appendChild(this.btn(S.settings, 'ghost', () => this.showSettings()));
    s.appendChild(col);

    s.appendChild(el('div', 'version', S.version));
    this.open('menu');
  }

  // ————— shop (hangar) —————

  showShop(): void {
    this.hideAll();
    const s = this.screen('shop');

    const header = el('div', 'row header');
    header.appendChild(this.btn(`‹ ${S.back}`, 'ghost small', () => this.showMenu()));
    header.appendChild(el('div', 'grow'));
    header.appendChild(this.coinChip(this.save.data.coins));
    s.appendChild(header);

    s.appendChild(el('h2', 'heading', S.shopTitle));
    s.appendChild(el('div', 'subheading', S.shopSub));

    const list = el('div', 'scroll list');
    for (const def of META_DEFS) {
      const lvl = metaLevel(this.save.data, def.id);
      const row = el('div', 'panel shop-row');
      row.style.setProperty('--i', String(META_DEFS.indexOf(def)));

      const icon = el('div', 'icon-wrap');
      icon.appendChild(paintIcon(def.icon, '#35f0ff', 38));
      row.appendChild(icon);

      const body = el('div', 'grow');
      body.appendChild(el('div', 'item-name', def.name));
      body.appendChild(el('div', 'item-desc', def.desc));
      body.appendChild(this.pips(lvl, def.max));
      row.appendChild(body);

      if (lvl >= def.max) {
        row.appendChild(el('span', 'maxed', S.max));
      } else {
        const cost = metaCost(def, lvl);
        const afford = this.save.data.coins >= cost;
        const buy = this.btn(String(cost), `buy small${afford ? '' : ' locked'}`, () => {
          if (this.save.data.coins < cost) {
            this.audio.play('deny');
            return;
          }
          this.save.data.coins -= cost;
          this.save.data.meta[def.id] = lvl + 1;
          this.save.persist();
          this.audio.play('buy');
          this.showShop();
        });
        buy.prepend(el('span', 'coin-dot'));
        row.appendChild(buy);
      }
      list.appendChild(row);
    }
    s.appendChild(list);
    this.open('shop');
  }

  // ————— settings —————

  showSettings(): void {
    this.hideAll();
    const s = this.screen('settings');

    const header = el('div', 'row header');
    header.appendChild(this.btn(`‹ ${S.back}`, 'ghost small', () => this.showMenu()));
    s.appendChild(header);

    s.appendChild(el('h2', 'heading', S.settings));

    const cfg = this.save.data.settings;
    const list = el('div', 'col list');
    const toggles: Array<[string, () => boolean, (v: boolean) => void]> = [
      [S.sound, () => cfg.sfx, (v) => { cfg.sfx = v; }],
      [S.music, () => cfg.music, (v) => { cfg.music = v; }],
      [S.haptics, () => cfg.haptics, (v) => { cfg.haptics = v; }],
      [S.lowFx, () => cfg.lowFx, (v) => { cfg.lowFx = v; }],
    ];
    for (const [label, get, set] of toggles) {
      list.appendChild(this.toggleRow(label, get, set));
    }
    s.appendChild(list);

    const info = el('div', 'subheading stats-line',
      `${S.runs}: ${this.save.data.runs} · ${S.totalKills}: ${this.save.data.totalKills}`);
    s.appendChild(info);

    s.appendChild(this.btn(S.resetData, 'danger', () => {
      this.confirm(S.resetConfirm, () => {
        this.save.reset();
        this.actions.applySettings();
        this.showSettings();
      });
    }));

    s.appendChild(el('div', 'version', S.version));
    this.open('settings');
  }

  private toggleRow(label: string, get: () => boolean, set: (v: boolean) => void): HTMLElement {
    const row = el('div', 'panel toggle-row');
    row.appendChild(el('span', 'grow item-name', label));
    const toggle = el('button', `toggle${get() ? ' on' : ''}`);
    toggle.setAttribute('role', 'switch');
    toggle.appendChild(el('span', 'knob'));
    toggle.addEventListener('click', () => {
      set(!get());
      toggle.classList.toggle('on', get());
      this.save.persist();
      this.actions.applySettings();
      this.audio.play('tap');
    });
    row.appendChild(toggle);
    return row;
  }

  // ————— confirm dialog —————

  confirm(message: string, onYes: () => void): void {
    const s = this.screen('confirm');
    const panel = el('div', 'panel dialog');
    panel.appendChild(el('p', 'dialog-text', message));
    const row = el('div', 'row gap');
    row.appendChild(this.btn(S.cancel, 'ghost small grow', () => this.close('confirm')));
    row.appendChild(this.btn(S.resetYes, 'danger small grow', () => {
      this.close('confirm');
      onYes();
    }));
    panel.appendChild(row);
    s.appendChild(panel);
    this.open('confirm');
  }

  // ————— in-game overlay —————

  showGameOverlay(): void {
    if (!this.pauseBtn) {
      const b = el('button', 'pausebtn');
      b.appendChild(el('span', 'pause-bar'));
      b.appendChild(el('span', 'pause-bar'));
      b.addEventListener('click', () => {
        this.audio.play('tap');
        this.actions.pauseRun();
      });
      this.root.appendChild(b);
      this.pauseBtn = b;
    }
    this.pauseBtn.classList.add('on');
  }

  hideGameOverlay(): void {
    this.pauseBtn?.classList.remove('on');
  }

  // ————— pause —————

  showPause(): void {
    const s = this.screen('pause');
    s.appendChild(el('h2', 'heading big', S.paused));
    const col = el('div', 'col actions');
    col.appendChild(this.btn(S.resume, 'primary', () => {
      this.close('pause');
      this.actions.resumeRun();
    }));
    col.appendChild(this.btn(S.restart, 'ghost', () => {
      this.close('pause');
      this.actions.restartRun();
    }));
    col.appendChild(this.btn(S.menu, 'ghost', () => {
      this.close('pause');
      this.actions.quitToMenu();
    }));
    s.appendChild(col);

    const cfg = this.save.data.settings;
    const quick = el('div', 'col list narrow');
    quick.appendChild(this.toggleRow(S.sound, () => cfg.sfx, (v) => { cfg.sfx = v; }));
    quick.appendChild(this.toggleRow(S.music, () => cfg.music, (v) => { cfg.music = v; }));
    s.appendChild(quick);
    this.open('pause');
  }

  // ————— level up —————

  showLevelUp(
    choices: UpgradeDef[],
    levelOf: (id: string) => number,
    onPick: (def: UpgradeDef) => void,
  ): void {
    const s = this.screen('levelup');
    s.appendChild(el('h2', 'heading glow', S.levelUpTitle));
    s.appendChild(el('div', 'subheading', S.levelUpSub));

    const cards = el('div', 'col cards');
    choices.forEach((def, i) => {
      const lvl = levelOf(def.id);
      const card = el('button', 'card');
      card.style.setProperty('--i', String(i));
      card.style.setProperty('--accent', def.color);

      const icon = el('div', 'icon-wrap');
      icon.appendChild(paintIcon(def.icon, def.color, 44));
      card.appendChild(icon);

      const body = el('div', 'grow');
      const nameRow = el('div', 'row');
      nameRow.appendChild(el('span', 'item-name', def.name));
      body.appendChild(nameRow);
      body.appendChild(this.pips(lvl, def.max, true));
      body.appendChild(el('div', 'item-desc', def.desc(lvl + 1)));
      card.appendChild(body);

      card.addEventListener('pointerdown', () => this.audio.play('tap'));
      card.addEventListener('click', () => {
        card.classList.add('picked');
        setTimeout(() => {
          this.close('levelup');
          onPick(def);
        }, 150);
      }, { once: true });
      cards.appendChild(card);
    });
    s.appendChild(cards);
    this.open('levelup');
  }

  // ————— game over —————

  showGameOver(stats: RunStats): void {
    this.hideGameOverlay();
    const s = this.screen('gameover');
    s.appendChild(el('h2', 'heading gameover-title', S.gameOver));
    if (stats.newRecord) {
      s.appendChild(el('div', 'record-badge', S.newRecord));
    }

    const panel = el('div', 'panel results');
    const addRow = (label: string, value: string): HTMLElement => {
      const row = el('div', 'row result-row');
      row.appendChild(el('span', 'grow item-desc', label));
      const v = el('span', 'result-value', value);
      row.appendChild(v);
      panel.appendChild(row);
      return v;
    };
    addRow(S.waveReached, String(stats.wave));
    addRow(S.kills, String(stats.kills));
    addRow(S.timeSurvived, fmtTime(stats.time));
    const scoreEl = addRow(S.score, '0');
    this.countUp(scoreEl, stats.score, 1);

    const coinsRow = el('div', 'row result-row coins-row');
    coinsRow.appendChild(el('span', 'grow item-desc', S.coinsEarned));
    coinsRow.appendChild(el('span', 'coin-dot'));
    const coinsEl = el('span', 'result-value amber', '0');
    coinsRow.appendChild(coinsEl);
    panel.appendChild(coinsRow);
    this.countUp(coinsEl, stats.coins, 1.2, '+');

    s.appendChild(panel);

    const col = el('div', 'col actions');
    col.appendChild(this.btn(S.playAgain, 'primary', () => this.actions.restartRun()));
    col.appendChild(this.btn(S.menu, 'ghost', () => this.actions.quitToMenu()));
    s.appendChild(col);
    this.open('gameover');
  }

  // ————— transient elements —————

  banner(text: string, sub?: string, danger = false): void {
    const b = el('div', `banner${danger ? ' danger' : ''}`);
    b.appendChild(el('div', 'banner-text', text));
    if (sub) b.appendChild(el('div', 'banner-sub', sub));
    this.root.appendChild(b);
    setTimeout(() => b.remove(), 2200);
  }

  showTutorial(): void {
    if (this.tutorial) return;
    const t = el('div', 'tutorial');
    const hand = el('div', 'tutorial-hand');
    hand.appendChild(el('span', 'tutorial-dot'));
    t.appendChild(hand);
    t.appendChild(el('div', 'tutorial-text', S.tutorialMove));
    t.appendChild(el('div', 'tutorial-sub', S.tutorialAuto));
    this.root.appendChild(t);
    this.tutorial = t;
  }

  hideTutorial(): void {
    if (!this.tutorial) return;
    const t = this.tutorial;
    this.tutorial = null;
    t.classList.add('off');
    setTimeout(() => t.remove(), 500);
  }
}
