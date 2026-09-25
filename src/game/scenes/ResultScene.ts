import Phaser from 'phaser';
import { DINOSAURS } from '../../data/dinosaurs';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { RunState } from '../core/RunState';
import { recordRun } from '../core/Save';
import { formatTime } from '../../utils/math';
import { centerDesign } from '../ui/layout';
import { COLORS, FONT_BOLD, RARITY_COLORS, button, hex, text } from '../ui/theme';
import type { Rarity } from '../../data/balance';
import { damageBreakdown, type DamageRow } from '../../data/damageSources';
import { CURRENT_PATCH } from '../../data/patchNotes';

const PANEL = { x: 600, y: 170, w: 530, h: 390 };
const MAX_DAMAGE_ROWS = 11;

/** Shared end-of-run screen; GameOverScene and VictoryScene only change the mood. */
export abstract class ResultScene extends Phaser.Scene {
  protected abstract readonly victory: boolean;

  create(data: { state: RunState }): void {
    const s = data.state;
    // s.victory: the story boss died (a death later in the endless mode still counts as a win).
    const save = recordRun(s.dinosaur, s.elapsedTime, s.victory, s.endless ? s.era : 0);
    const dino = DINOSAURS[s.dinosaur];

    centerDesign(this, [
      this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'ground').setAlpha(0.4),
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, this.victory ? 0x1a1408 : 0x1a0808, 0.75),
    ]);

    const titleText = this.victory ? 'VITÓRIA!' : s.endless ? `ERA ${s.era}` : 'EXTINTO';
    const title = this.add.text(GAME_WIDTH / 2, 70, titleText, {
      fontFamily: FONT_BOLD, fontSize: '72px', color: this.victory ? '#ffd24a' : s.endless ? '#e0a0ff' : '#ff5a4a', stroke: '#000000', strokeThickness: 12,
    }).setOrigin(0.5).setScale(1.6).setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 500, ease: 'Back.easeOut' });
    const subtitle = this.victory
      ? 'O Giganotosaurus caiu. Você é o predador supremo.'
      : s.endless
        ? `Vitória garantida — e sua linhagem resistiu até a Era ${s.era} da Era Sem Fim.`
        : 'Sua linhagem termina aqui... por enquanto.';
    text(this, GAME_WIDTH / 2, 128, subtitle, 18, '#e8dcc0', true).setOrigin(0.5);

    if (this.victory) {
      const e = this.add.particles(GAME_WIDTH / 2, -10, 'spark', {
        x: { min: -this.scale.width / 2, max: this.scale.width / 2 }, speedY: { min: 80, max: 200 }, speedX: { min: -40, max: 40 },
        lifespan: 4000, scale: { start: 1.2, end: 0.4 }, tint: [0xffd24a, 0xffffff, 0xff8a3a], frequency: 60, rotate: { min: 0, max: 360 },
      });
      e.setDepth(-1);
    }

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.95);
    panel.fillRoundedRect(150, 170, 420, 390, 12);
    panel.fillRoundedRect(600, 170, 530, 390, 12);
    panel.lineStyle(2, COLORS.border, 1);
    panel.strokeRoundedRect(150, 170, 420, 390, 12);
    panel.strokeRoundedRect(600, 170, 530, 390, 12);

    const rows: [string, string][] = [
      ['DINOSSAURO', dino.name],
      ['TEMPO SOBREVIVIDO', formatTime(s.elapsedTime)],
      ['NÍVEL', `${s.level}`],
      ['ABATES', `${s.kills}`],
      ['DANO CAUSADO', Math.round(s.damageDealt).toLocaleString('pt-BR')],
      ['DANO RECEBIDO', Math.round(s.damageTaken).toLocaleString('pt-BR')],
      s.endless
        ? ['ERA SEM FIM', `Era ${s.era} · ${formatTime(s.endlessTime)}`]
        : ['ELITE', s.eliteKilled ? 'Derrotada' : '—'],
      ['BUILD', s.primaryTag ? s.primaryTag.toUpperCase() : '—'],
      s.endless
        ? ['MELHOR ERA', `${save.bestEraByDino[s.dinosaur] ?? s.era}`]
        : ['MELHOR TEMPO', formatTime(save.bestTime)],
    ];
    rows.forEach(([k, v], i) => {
      text(this, 175, 190 + i * 39, k, 16, COLORS.muted, true);
      text(this, 545, 190 + i * 39, v, 18, '#ffffff', true).setOrigin(1, 0);
    });

    this.buildRightPanel(s);

    if (s.endless && s.mutations.length) {
      text(this, GAME_WIDTH / 2, 582, `MUTAÇÕES DE ERA: ${s.mutations.join(' · ')}`, 15, '#e0a0ff', true).setOrigin(0.5, 0);
    }

    button(this, GAME_WIDTH / 2 - 150, GAME_HEIGHT - 80, 'JOGAR NOVAMENTE', () => this.scene.start('Run', { dino: s.dinosaur }), { width: 280 });
    button(this, GAME_WIDTH / 2 + 150, GAME_HEIGHT - 80, 'MENU', () => this.scene.start('Menu'), { width: 220, color: 0x7a8a6a });
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('Run', { dino: s.dinosaur }));
    this.cameras.main.fadeIn(400);
  }

  /** Right panel: tabs "DANO POR FONTE" (default) and "MUTAÇÕES", plus a copy-to-clipboard button. */
  private buildRightPanel(s: RunState): void {
    const rows = damageBreakdown(s.damageBySource, s.dinosaur);
    const damageTab = this.buildDamageTab(rows);
    const upgradesTab = this.buildUpgradesTab(s);

    const tabs: { label: string; view: Phaser.GameObjects.Container; t?: Phaser.GameObjects.Text }[] = [
      { label: 'DANO POR FONTE', view: damageTab },
      { label: `MUTAÇÕES (${s.upgrades.length})`, view: upgradesTab },
    ];
    const select = (i: number) => tabs.forEach((tab, j) => {
      tab.view.setVisible(i === j);
      tab.t!.setColor(i === j ? COLORS.accentText : COLORS.muted).setAlpha(i === j ? 1 : 0.8);
    });
    let x = PANEL.x + 20;
    tabs.forEach((tab, i) => {
      tab.t = text(this, x, PANEL.y + 16, tab.label, 17, COLORS.muted, true).setInteractive({ useHandCursor: true });
      tab.t.on('pointerdown', () => select(i));
      x += tab.t.width + 26;
    });
    select(0);
    this.input.keyboard?.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      select(damageTab.visible ? 1 : 0);
    });

    const copyBtn = button(this, PANEL.x + PANEL.w - 72, PANEL.y + 26, 'COPIAR', () => {
      void copyText(runReport(s, rows)).then((ok) => {
        // Feedback on the button itself: [bg, label] is the container built by theme.button().
        const label = copyBtn.list[1] as Phaser.GameObjects.Text;
        label.setText(ok ? 'COPIADO!' : 'FALHOU');
        this.time.delayedCall(1500, () => { if (label.active) label.setText('COPIAR'); });
      });
    }, { width: 112, height: 34, fontSize: 15, color: 0x8a9a6a });
  }

  private buildDamageTab(rows: DamageRow[]): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const top = PANEL.y + 58;
    if (rows.length === 0) {
      c.add(text(this, PANEL.x + 20, top, 'Nenhum dano causado.', 16, COLORS.muted));
      return c;
    }
    let shown = rows;
    if (rows.length > MAX_DAMAGE_ROWS) {
      const rest = rows.slice(MAX_DAMAGE_ROWS - 1);
      shown = [...rows.slice(0, MAX_DAMAGE_ROWS - 1), {
        key: 'rest', label: `Outras ${rest.length} fontes`,
        amount: rest.reduce((a, r) => a + r.amount, 0), share: rest.reduce((a, r) => a + r.share, 0),
      }];
    }
    const left = PANEL.x + 20;
    const barW = PANEL.w - 40;
    const g = this.add.graphics();
    c.add(g);
    shown.forEach((r, i) => {
      const y = top + i * 29;
      g.fillStyle(i === 0 ? COLORS.accent : 0x6a7a52, i === 0 ? 0.35 : 0.3);
      g.fillRoundedRect(left, y - 3, Math.max(4, barW * (r.share / shown[0].share)), 25, 4);
      c.add(text(this, left + 8, y, r.label, 15, '#ffffff', true));
      c.add(text(this, left + barW - 8, y, `${Math.round(r.amount).toLocaleString('pt-BR')}  ·  ${formatShare(r.share)}`, 15, '#f2ecd8', true).setOrigin(1, 0));
    });
    return c;
  }

  private buildUpgradesTab(s: RunState): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    if (s.upgrades.length === 0) c.add(text(this, PANEL.x + 20, PANEL.y + 58, 'Nenhuma.', 16, COLORS.muted));
    s.upgrades.forEach((u, i) => {
      const col = Math.floor(i / 12);
      const row = i % 12;
      c.add(text(this, PANEL.x + 20 + col * 255, PANEL.y + 56 + row * 27, `${u.name}${u.level > 1 ? ` ${u.level}` : ''}`, 15, hex(RARITY_COLORS[u.rarity as Rarity] ?? 0xffffff), true));
    });
    return c;
  }
}

function formatShare(share: number): string {
  const pct = share * 100;
  return pct >= 10 ? `${Math.round(pct)}%` : `${pct.toFixed(1).replace('.', ',')}%`;
}

/** Plain-text summary players can paste in a chat/issue, so balance can be tuned with real runs. */
function runReport(s: RunState, rows: DamageRow[]): string {
  const outcome = s.victory ? (s.endless ? `Vitória · Era ${s.era}` : 'Vitória') : 'Derrota';
  const total = rows.reduce((a, r) => a + r.amount, 0);
  return [
    `DinoMutation v${CURRENT_PATCH.version} · ${DINOSAURS[s.dinosaur].name} · ${outcome} · ${formatTime(s.elapsedTime)} · nível ${s.level} · ${s.kills} abates`,
    `Dano recebido: ${Math.round(s.damageTaken).toLocaleString('pt-BR')}`,
    `Mutações: ${s.upgrades.map((u) => `${u.name}${u.level > 1 ? ` ${u.level}` : ''}`).join(', ') || '—'}`,
    `Dano por fonte (total ${Math.round(total).toLocaleString('pt-BR')}):`,
    ...rows.map((r) => `- ${r.label}: ${Math.round(r.amount).toLocaleString('pt-BR')} (${formatShare(r.share)})`),
  ].join('\n');
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // Clipboard API needs a secure context; fall back to the legacy command.
    try {
      const area = document.createElement('textarea');
      area.value = value;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export class GameOverScene extends ResultScene {
  protected readonly victory = false;
  constructor() {
    super('GameOver');
  }
}

export class VictoryScene extends ResultScene {
  protected readonly victory = true;
  constructor() {
    super('Victory');
  }
}
