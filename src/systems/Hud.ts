import type { UpgradeDef } from '../game/Upgrades';

export type GameState = 'menu' | 'playing' | 'paused' | 'gameover' | 'upgrade';

export type HudSnapshot = {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  score: number;
  combo: number;
  comboTimer: number;
  wave: number;
  waveLabel: string;
  enemiesLeft: number;
  dashReady: number;
  rapidTimer: number;
  highScore: number;
  state: GameState;
  banner: string;
  bannerSub: string;
  weapon?: string;
  upgradeCount?: number;
  secondaries?: string[];
  statsBlock?: string;
};

const WEAPON_LABEL: Record<string, string> = {
  scatter: '散弹',
  lance: '光矛',
  homing: '追踪',
  blackhole: '黑洞',
  missile: '导弹',
  reflect: '反射',
};

const SECONDARY_LABEL: Record<string, string> = {
  orbit: '光轮',
  missilePod: '导弹舱',
  nova: '新星',
  turret: '炮塔',
};

export class Hud {
  private readonly root: HTMLElement;
  private readonly scoreEl: HTMLElement;
  private readonly comboEl: HTMLElement;
  private readonly waveEl: HTMLElement;
  private readonly enemiesEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly healthText: HTMLElement;
  private readonly shieldFill: HTMLElement;
  private readonly dashFill: HTMLElement;
  private readonly rapidFill: HTMLElement;
  private readonly menu: HTMLElement;
  private readonly pause: HTMLElement;
  private readonly gameover: HTMLElement;
  private readonly upgrade: HTMLElement;
  private readonly upgradeCards: HTMLElement;
  private readonly finalScore: HTMLElement;
  private readonly finalWave: HTMLElement;
  private readonly finalBest: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly bannerSub: HTMLElement;
  private readonly weaponEl: HTMLElement;
  private readonly upgradesEl: HTMLElement;
  private readonly secondaryEl: HTMLElement;
  private readonly statsEl: HTMLElement;

  // dirty-check caches — avoid layout/DOM writes every frame
  private lastScore = '';
  private lastCombo = '';
  private lastWave = '';
  private lastEnemies = '';
  private lastStatus = '';
  private lastWeapon = '';
  private lastUpgrades = '';
  private lastSecondary = '';
  private lastStatsBlock = '';
  private lastHealthText = '';
  private lastHealthPct = -1;
  private lastShieldPct = -1;
  private lastDashPct = -1;
  private lastRapidPct = -1;
  private lastState: GameState | null = null;
  private lastFinalScore = '';
  private lastFinalWave = '';
  private lastFinalBest = '';

  constructor() {
    this.root = this.get('#hud');
    this.scoreEl = this.get('#score-value');
    this.comboEl = this.get('#combo-value');
    this.waveEl = this.get('#wave-value');
    this.enemiesEl = this.get('#enemies-value');
    this.statusEl = this.get('#status-line');
    this.healthFill = this.get('#health-fill');
    this.healthText = this.get('#health-text');
    this.shieldFill = this.get('#shield-fill');
    this.dashFill = this.get('#dash-fill');
    this.rapidFill = this.get('#rapid-fill');
    this.menu = this.get('#menu-overlay');
    this.pause = this.get('#pause-overlay');
    this.gameover = this.get('#gameover-overlay');
    this.upgrade = this.get('#upgrade-overlay');
    this.upgradeCards = this.get('#upgrade-cards');
    this.finalScore = this.get('#final-score');
    this.finalWave = this.get('#final-wave');
    this.finalBest = this.get('#final-best');
    this.banner = this.get('#wave-banner');
    this.bannerSub = this.get('#wave-banner-sub');
    this.weaponEl = this.get('#weapon-value');
    this.upgradesEl = this.get('#upgrades-value');
    this.secondaryEl = this.get('#secondary-value');
    this.statsEl = this.get('#pause-stats');
  }

  flashPickup(): void {
    this.root.classList.add('flash');
    window.setTimeout(() => this.root.classList.remove('flash'), 250);
  }

  showBanner(title: string, sub = ''): void {
    this.banner.textContent = title;
    this.bannerSub.textContent = sub;
    this.banner.classList.remove('show');
    this.bannerSub.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
    if (sub) this.bannerSub.classList.add('show');
  }

  setUpgradeChoices(defs: UpgradeDef[]): void {
    this.upgradeCards.innerHTML = '';
    defs.forEach((def, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'upgrade-card';
      card.dataset.index = String(index);
      card.innerHTML = `
        <span class="upgrade-key">${index + 1}</span>
        <span class="upgrade-tag tag-${def.tag}">${def.tag}</span>
        <strong>${def.name}</strong>
        <p>${def.description}</p>
      `;
      card.addEventListener('click', () => {
        card.dispatchEvent(
          new CustomEvent('upgrade-pick', { bubbles: true, detail: { id: def.id, index } }),
        );
      });
      this.upgradeCards.appendChild(card);
    });
    this.highlightUpgrade(0);
    this.upgrade.classList.remove('hidden');
  }

  clearUpgradeChoices(): void {
    this.upgrade.classList.add('hidden');
    this.upgradeCards.innerHTML = '';
  }

  highlightUpgrade(index: number): void {
    const cards = this.upgradeCards.querySelectorAll<HTMLElement>('.upgrade-card');
    cards.forEach((card, i) => card.classList.toggle('selected', i === index));
  }

  update(snapshot: HudSnapshot, delta: number): void {
    void delta;
    const hpPct = (snapshot.health / snapshot.maxHealth) * 100;
    const shieldPct = (snapshot.shield / Math.max(1, snapshot.maxShield)) * 100;
    const dashPct = Math.max(0, snapshot.dashReady) * 100;
    const rapidPct = Math.min(100, snapshot.rapidTimer * 33);
    const healthText = String(Math.ceil(snapshot.health));

    if (this.lastHealthPct !== hpPct) {
      this.lastHealthPct = hpPct;
      this.healthFill.style.width = `${hpPct}%`;
    }
    if (this.lastHealthText !== healthText) {
      this.lastHealthText = healthText;
      this.healthText.textContent = healthText;
    }
    if (this.lastShieldPct !== shieldPct) {
      this.lastShieldPct = shieldPct;
      this.shieldFill.style.width = `${shieldPct}%`;
    }
    if (this.lastDashPct !== dashPct) {
      this.lastDashPct = dashPct;
      this.dashFill.style.width = `${dashPct}%`;
    }
    if (this.lastRapidPct !== rapidPct) {
      this.lastRapidPct = rapidPct;
      this.rapidFill.style.width = `${rapidPct}%`;
    }

    const scoreText = String(snapshot.score);
    if (this.lastScore !== scoreText) {
      this.lastScore = scoreText;
      this.scoreEl.textContent = snapshot.score.toLocaleString();
    }
    const comboText = `x${snapshot.combo}`;
    if (this.lastCombo !== comboText) {
      this.lastCombo = comboText;
      this.comboEl.textContent = comboText;
    }
    const waveText = String(snapshot.wave);
    if (this.lastWave !== waveText) {
      this.lastWave = waveText;
      this.waveEl.textContent = waveText;
    }
    const enemiesText = String(snapshot.enemiesLeft);
    if (this.lastEnemies !== enemiesText) {
      this.lastEnemies = enemiesText;
      this.enemiesEl.textContent = enemiesText;
    }
    const statusText = snapshot.banner || snapshot.waveLabel;
    if (this.lastStatus !== statusText) {
      this.lastStatus = statusText;
      this.statusEl.textContent = statusText;
    }
    const weaponText = WEAPON_LABEL[snapshot.weapon ?? 'pulse'] ?? '脉冲';
    if (this.lastWeapon !== weaponText) {
      this.lastWeapon = weaponText;
      this.weaponEl.textContent = weaponText;
    }
    const upgradesText = String(snapshot.upgradeCount ?? 0);
    if (this.lastUpgrades !== upgradesText) {
      this.lastUpgrades = upgradesText;
      this.upgradesEl.textContent = upgradesText;
    }

    const secs = snapshot.secondaries;
    let secondaryText = '—';
    if (secs && secs.length > 0) {
      secondaryText = '';
      for (let i = 0; i < secs.length; i++) {
        if (i > 0) secondaryText += ' · ';
        secondaryText += SECONDARY_LABEL[secs[i]] ?? secs[i];
      }
    }
    if (this.lastSecondary !== secondaryText) {
      this.lastSecondary = secondaryText;
      this.secondaryEl.textContent = secondaryText;
    }

    // stats panel only rebuilds when the HTML actually changes (pause menu)
    const statsBlock = snapshot.statsBlock ?? '';
    if (statsBlock && this.lastStatsBlock !== statsBlock) {
      this.lastStatsBlock = statsBlock;
      this.statsEl.innerHTML = statsBlock;
    }

    if (this.lastState !== snapshot.state) {
      this.lastState = snapshot.state;
      this.menu.classList.toggle('hidden', snapshot.state !== 'menu');
      this.pause.classList.toggle('hidden', snapshot.state !== 'paused');
      this.gameover.classList.toggle('hidden', snapshot.state !== 'gameover');
      this.root.classList.toggle('dimmed', snapshot.state !== 'playing');
      if (snapshot.state !== 'upgrade') {
        this.upgrade.classList.add('hidden');
      }
    }

    if (snapshot.state === 'gameover') {
      const fs = String(snapshot.score);
      if (this.lastFinalScore !== fs) {
        this.lastFinalScore = fs;
        this.finalScore.textContent = snapshot.score.toLocaleString();
      }
      const fw = String(snapshot.wave);
      if (this.lastFinalWave !== fw) {
        this.lastFinalWave = fw;
        this.finalWave.textContent = fw;
      }
      const fb = String(snapshot.highScore);
      if (this.lastFinalBest !== fb) {
        this.lastFinalBest = fb;
        this.finalBest.textContent = snapshot.highScore.toLocaleString();
      }
    }
  }

  private get(selector: string): HTMLElement {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`Missing element: ${selector}`);
    return el;
  }
}
