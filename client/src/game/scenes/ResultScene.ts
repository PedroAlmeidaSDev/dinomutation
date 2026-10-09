import Phaser from 'phaser';
import { DIFFICULTY_BY_ID } from '../../data/difficulty';
import { DINOSAURS } from '../../data/dinosaurs';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { RunState } from '../core/RunState';
import type { RunRewards } from '../core/Save';
import { masteryProgress } from '../../data/meta';
import { formatTime } from '../../utils/math';
import { centerDesign } from '../ui/layout';
import { COLORS, RARITY_COLORS, button, drawBar, drawPanel, hex, text, title as titleText } from '../ui/theme';
import type { Rarity } from '../../data/balance';
import { damageBreakdown, type DamageRow } from '../../data/damageSources';
import { CURRENT_PATCH } from '../../data/patchNotes';
import type { ResultSceneData } from './RunScene';

const PANEL = { x: 600, y: 170, w: 530, h: 350 };
const MAX_DAMAGE_ROWS = 10;

/** Shared end-of-run screen; GameOverScene and VictoryScene only change the mood. */
export abstract class ResultScene extends Phaser.Scene {
  protected abstract readonly victory: boolean;

  create(data: ResultSceneData): void {
    const s = data.state;
    const dino = DINOSAURS[s.dinosaur];

    centerDesign(this, [
      this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'ground').setAlpha(0.4),
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.8),
    ]);

    const heading = this.victory ? 'VITÓRIA!' : s.endless ? `ERA ${s.era}` : 'EXTINTO';
    const title = titleText(this, GAME_WIDTH / 2, 70, heading, 72, this.victory ? COLORS.acid : s.endless ? 0xc070ff : COLORS.accent)
      .setOrigin(0.5).setScale(1.6).setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 500, ease: 'Back.easeOut' });
    const subtitle = this.victory
      ? 'O Giganotosaurus caiu. Você é o predador supremo.'
      : s.endless
        ? `Vitória garantida — e sua linhagem resistiu até a Era ${s.era} da Era Sem Fim.`
        : 'Sua linhagem termina aqui... por enquanto.';
    text(this, GAME_WIDTH / 2, 128, subtitle, 17, COLORS.muted).setOrigin(0.5);

    if (this.victory) {
      const e = this.add.particles(GAME_WIDTH / 2, -10, 'spark', {
        x: { min: -this.scale.width / 2, max: this.scale.width / 2 }, speedY: { min: 80, max: 200 }, speedX: { min: -40, max: 40 },
        lifespan: 4000, scale: { start: 1.2, end: 0.4 }, tint: [COLORS.acid, 0xffffff, COLORS.accent], frequency: 60, rotate: { min: 0, max: 360 },
      });
      e.setDepth(-1);
    }

    const panel = this.add.graphics();
    drawPanel(panel, 150, 170, 420, PANEL.h, { cut: 14 });
    drawPanel(panel, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { cut: 14 });
    panel.fillStyle(COLORS.border, 1);
    panel.fillRect(PANEL.x + 16, PANEL.y + 46, PANEL.w - 32, 1);

    const rows: [string, string][] = [
      ['DINOSSAURO', `${dino.name} · ${DIFFICULTY_BY_ID[s.difficulty].name}`],
      ['TEMPO SOBREVIVIDO', formatTime(s.elapsedTime)],
      ['NÍVEL', `${s.level}`],
      ['ABATES', `${s.kills}`],
      ['DANO CAUSADO', Math.round(s.damageDealt).toLocaleString('pt-BR')],
      ['DANO RECEBIDO', Math.round(s.damageTaken).toLocaleString('pt-BR')],
      s.endless
        ? ['ERA SEM FIM', `Era ${s.era} · ${formatTime(s.endlessTime)}`]
        : ['ELITE', s.eliteKilled ? 'Derrotada' : '—'],
      ['BUILD', s.primaryTag ? s.primaryTag.toUpperCase() : '—'],
    ];
    rows.forEach(([k, v], i) => {
      text(this, 175, 186 + i * 36, k, 16, COLORS.muted, true);
      text(this, 545, 186 + i * 36, v, 18, COLORS.text, true).setOrigin(1, 0);
    });
    // The last row is a record (best time / best era): it comes from the save, filled in once it answers.
    const bestY = 186 + rows.length * 36;
    text(this, 175, bestY, s.endless ? 'MELHOR ERA' : 'MELHOR TEMPO', 16, COLORS.muted, true);
    const bestValue = text(this, 545, bestY, '…', 18, COLORS.text, true).setOrigin(1, 0);

    this.buildRightPanel(s);

    if (s.endless && s.mutations.length) {
      // Below the stat rows, clear of the rewards strip.
      text(this, 175, 494, `MUTAÇÕES DE ERA: ${s.mutations.join(' · ')}`, 13, '#e0a0ff', true).setWordWrapWidth(390);
    }

    const saving = text(this, GAME_WIDTH / 2, 566, 'Salvando…', 16, COLORS.muted, true).setOrigin(0.5);
    // s.victory: the story boss died (a death later in the endless mode still counts as a win).
    // The run's own store: if the session was lost mid-run this is still the account's.
    data.store.recordRun(s, s.victory).then(({ save, rewards, pending }) => {
      if (!this.sys.isActive()) return;
      saving.destroy();
      bestValue.setText(s.endless ? `${save.bestEraByDino[s.dinosaur] ?? s.era}` : formatTime(save.bestTime));
      this.drawRewards(s.dinosaur, save.mastery[s.dinosaur] ?? 0, rewards);
      if (pending) {
        text(this, GAME_WIDTH / 2, 150, 'Não foi possível salvar agora; a run foi guardada e será enviada na próxima vez que você entrar na conta.', 13, COLORS.danger, true)
          .setOrigin(0.5);
      }
    }).catch(() => {
      if (this.sys.isActive()) saving.setText('Não foi possível salvar esta run.').setColor(COLORS.danger);
    });

    const again = { dino: s.dinosaur, difficulty: s.difficulty };
    button(this, GAME_WIDTH / 2 - 150, GAME_HEIGHT - 80, 'JOGAR NOVAMENTE', () => this.scene.start('Run', again), { width: 280 });
    button(this, GAME_WIDTH / 2 + 150, GAME_HEIGHT - 80, 'MENU', () => this.scene.start('Menu'), { width: 220, ghost: true });
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('Run', again));
    this.cameras.main.fadeIn(400);
  }

  /** Fossils earned + mastery bar filling up for the dinosaur just played. */
  private drawRewards(dinoId: RunState['dinosaur'], masteryXp: number, r: RunRewards): void {
    const dino = DINOSAURS[dinoId];
    const g = this.add.graphics();
    drawPanel(g, 150, 532, 980, 68, { cut: 12, stroke: COLORS.accent, strokeAlpha: 0.6 });

    text(this, 175, 540, r.firstWinBonus ? `FÓSSEIS · 1ª VITÓRIA +${r.firstWinBonus}` : 'FÓSSEIS', 14, r.firstWinBonus ? COLORS.acidText : COLORS.muted, true);
    const fossils = text(this, 175, 558, '+0', 28, COLORS.accentText, true);
    this.tweens.addCounter({
      from: 0, to: r.fossils, duration: 900, delay: 300, ease: 'Cubic.easeOut',
      onUpdate: (t) => fossils.setText(`+${Math.round(t.getValue() ?? 0)}`),
    });

    const prog = masteryProgress(masteryXp);
    const leveled = r.levelAfter > r.levelBefore;
    text(this, 360, 540, `MAESTRIA ${dino.name} · NÍVEL ${prog.level}${leveled ? '  ▲' : ''}   (+${r.masteryXp} XP)`, 14, leveled ? COLORS.acidText : COLORS.muted, true);
    const barX = 360;
    const barW = 380;
    const bar = this.add.graphics();
    const fillTo = prog.needed > 0 ? prog.into / prog.needed : 1;
    const fillFrom = leveled ? 0 : Math.max(0, (prog.into - r.masteryXp) / (prog.needed || 1));
    const paint = (f: number) => {
      bar.clear();
      drawBar(bar, barX, 570, barW, 8, f, dino.accentColor);
    };
    paint(fillFrom);
    this.tweens.addCounter({ from: fillFrom, to: fillTo, duration: 900, delay: 300, ease: 'Cubic.easeOut', onUpdate: (t) => paint(t.getValue() ?? fillTo) });
    text(this, barX + barW + 8, 564, prog.needed > 0 ? `${prog.into}/${prog.needed}` : 'MÁX.', 14, COLORS.text, true);

    const unlocks = r.unlockedDifficulty ? [`Dificuldade ${r.unlockedDifficulty}`, ...r.unlocks] : r.unlocks;
    if (unlocks.length > 0) {
      const more = unlocks.length > 2 ? ` +${unlocks.length - 2}` : '';
      text(this, 850, 540, 'DESBLOQUEADO!', 14, COLORS.acidText, true);
      text(this, 850, 560, unlocks.slice(0, 2).join('\n') + more, 13, COLORS.text, true);
    } else {
      text(this, 850, 548, 'Gaste fósseis no COVIL\npara fortalecer seus dinos.', 14, COLORS.muted);
    }
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
    }, { width: 112, height: 34, fontSize: 14, ghost: true, color: COLORS.acid });
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
      const bw = Math.max(8, barW * (r.share / shown[0].share));
      g.fillStyle(i === 0 ? COLORS.accent : 0xffffff, i === 0 ? 0.35 : 0.07);
      g.fillRect(left, y - 3, bw, 25);
      c.add(text(this, left + 8, y, r.label, 15, COLORS.text, true));
      c.add(text(this, left + barW - 8, y, `${Math.round(r.amount).toLocaleString('pt-BR')}  ·  ${formatShare(r.share)}`, 15, COLORS.muted, true).setOrigin(1, 0));
    });
    return c;
  }

  private buildUpgradesTab(s: RunState): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    if (s.upgrades.length === 0) c.add(text(this, PANEL.x + 20, PANEL.y + 58, 'Nenhuma.', 16, COLORS.muted));
    s.upgrades.forEach((u, i) => {
      const col = Math.floor(i / 11);
      const row = i % 11;
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
    `DinoMutation v${CURRENT_PATCH.version} · ${DINOSAURS[s.dinosaur].name} (${DIFFICULTY_BY_ID[s.difficulty].name}) · ${outcome} · ${formatTime(s.elapsedTime)} · nível ${s.level} · ${s.kills} abates`,
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
