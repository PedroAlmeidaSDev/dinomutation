import Phaser from 'phaser';
import { DINOSAURS } from '../../data/dinosaurs';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { RunState } from '../core/RunState';
import { recordRun, type RunRewards } from '../core/Save';
import { masteryProgress } from '../../data/meta';
import { formatTime } from '../../utils/math';
import { COLORS, FONT_BOLD, RARITY_COLORS, button, hex, text } from '../ui/theme';
import type { Rarity } from '../../data/balance';

/** Shared end-of-run screen; GameOverScene and VictoryScene only change the mood. */
export abstract class ResultScene extends Phaser.Scene {
  protected abstract readonly victory: boolean;

  create(data: { state: RunState }): void {
    const s = data.state;
    const { save, rewards } = recordRun(s, this.victory);
    const dino = DINOSAURS[s.dinosaur];

    this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'ground').setOrigin(0).setAlpha(0.4);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, this.victory ? 0x1a1408 : 0x1a0808, 0.75).setOrigin(0);

    const titleText = this.victory ? 'VITÓRIA!' : 'EXTINTO';
    const title = this.add.text(GAME_WIDTH / 2, 70, titleText, {
      fontFamily: FONT_BOLD, fontSize: '72px', color: this.victory ? '#ffd24a' : '#ff5a4a', stroke: '#000000', strokeThickness: 12,
    }).setOrigin(0.5).setScale(1.6).setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 500, ease: 'Back.easeOut' });
    text(this, GAME_WIDTH / 2, 128,
      this.victory ? 'O Giganotosaurus caiu. Você é o predador supremo.' : 'Sua linhagem termina aqui... por enquanto.',
      18, '#e8dcc0', true).setOrigin(0.5);

    if (this.victory) {
      const e = this.add.particles(GAME_WIDTH / 2, -10, 'spark', {
        x: { min: -GAME_WIDTH / 2, max: GAME_WIDTH / 2 }, speedY: { min: 80, max: 200 }, speedX: { min: -40, max: 40 },
        lifespan: 4000, scale: { start: 1.2, end: 0.4 }, tint: [0xffd24a, 0xffffff, 0xff8a3a], frequency: 60, rotate: { min: 0, max: 360 },
      });
      e.setDepth(-1);
    }

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.95);
    panel.fillRoundedRect(150, 170, 420, 350, 12);
    panel.fillRoundedRect(600, 170, 530, 350, 12);
    panel.lineStyle(2, COLORS.border, 1);
    panel.strokeRoundedRect(150, 170, 420, 350, 12);
    panel.strokeRoundedRect(600, 170, 530, 350, 12);

    const rows: [string, string][] = [
      ['DINOSSAURO', dino.name],
      ['TEMPO SOBREVIVIDO', formatTime(s.elapsedTime)],
      ['NÍVEL', `${s.level}`],
      ['ABATES', `${s.kills}`],
      ['DANO CAUSADO', Math.round(s.damageDealt).toLocaleString('pt-BR')],
      ['DANO RECEBIDO', Math.round(s.damageTaken).toLocaleString('pt-BR')],
      ['ELITE', s.eliteKilled ? 'Derrotada' : '—'],
      ['BUILD', s.primaryTag ? s.primaryTag.toUpperCase() : '—'],
      ['MELHOR TEMPO', formatTime(save.bestTime)],
    ];
    rows.forEach(([k, v], i) => {
      text(this, 175, 186 + i * 36, k, 16, COLORS.muted, true);
      text(this, 545, 186 + i * 36, v, 18, '#ffffff', true).setOrigin(1, 0);
    });

    text(this, 620, 186, `MUTAÇÕES (${s.upgrades.length})`, 18, COLORS.accentText, true);
    if (s.upgrades.length === 0) text(this, 620, 222, 'Nenhuma.', 16, COLORS.muted);
    s.upgrades.forEach((u, i) => {
      const col = Math.floor(i / 11);
      const row = i % 11;
      text(this, 620 + col * 255, 220 + row * 27, `${u.name}${u.level > 1 ? ` ${u.level}` : ''}`, 15, hex(RARITY_COLORS[u.rarity as Rarity] ?? 0xffffff), true);
    });

    this.drawRewards(s.dinosaur, save.mastery[s.dinosaur] ?? 0, rewards);

    button(this, GAME_WIDTH / 2 - 150, GAME_HEIGHT - 80, 'JOGAR NOVAMENTE', () => this.scene.start('Run', { dino: s.dinosaur }), { width: 280 });
    button(this, GAME_WIDTH / 2 + 150, GAME_HEIGHT - 80, 'MENU', () => this.scene.start('Menu'), { width: 220, color: 0x7a8a6a });
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('Run', { dino: s.dinosaur }));
    this.cameras.main.fadeIn(400);
  }

  /** Fossils earned + mastery bar filling up for the dinosaur just played. */
  private drawRewards(dinoId: RunState['dinosaur'], masteryXp: number, r: RunRewards): void {
    const dino = DINOSAURS[dinoId];
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.95);
    g.fillRoundedRect(150, 532, 980, 68, 12);
    g.lineStyle(2, COLORS.accent, 0.8);
    g.strokeRoundedRect(150, 532, 980, 68, 12);

    text(this, 175, 540, 'FÓSSEIS', 14, COLORS.muted, true);
    const fossils = text(this, 175, 558, '+0', 28, COLORS.accentText, true);
    this.tweens.addCounter({
      from: 0, to: r.fossils, duration: 900, delay: 300, ease: 'Cubic.easeOut',
      onUpdate: (t) => fossils.setText(`+${Math.round(t.getValue() ?? 0)}`),
    });

    const prog = masteryProgress(masteryXp);
    const leveled = r.levelAfter > r.levelBefore;
    text(this, 360, 540, `MAESTRIA ${dino.name} · NÍVEL ${prog.level}${leveled ? '  ▲' : ''}   (+${r.masteryXp} XP)`, 14, leveled ? '#6aff8a' : COLORS.muted, true);
    const barX = 360;
    const barW = 380;
    const bar = this.add.graphics();
    const fillTo = prog.needed > 0 ? prog.into / prog.needed : 1;
    const fillFrom = leveled ? 0 : Math.max(0, (prog.into - r.masteryXp) / (prog.needed || 1));
    const drawBar = (f: number) => {
      bar.clear();
      bar.fillStyle(0x30382a, 1);
      bar.fillRoundedRect(barX, 566, barW, 16, 5);
      bar.fillStyle(dino.accentColor, 1);
      bar.fillRoundedRect(barX, 566, Math.max(6, barW * f), 16, 5);
    };
    drawBar(fillFrom);
    this.tweens.addCounter({ from: fillFrom, to: fillTo, duration: 900, delay: 300, ease: 'Cubic.easeOut', onUpdate: (t) => drawBar(t.getValue() ?? fillTo) });
    text(this, barX + barW + 8, 564, prog.needed > 0 ? `${prog.into}/${prog.needed}` : 'MÁX.', 14, '#ffffff', true);

    if (r.unlocks.length > 0) {
      const more = r.unlocks.length > 2 ? ` +${r.unlocks.length - 2}` : '';
      text(this, 850, 540, 'DESBLOQUEADO!', 14, '#6aff8a', true);
      text(this, 850, 560, r.unlocks.slice(0, 2).join('\n') + more, 13, '#ffffff', true);
    } else {
      text(this, 850, 548, 'Gaste fósseis no COVIL\npara fortalecer seus dinos.', 14, COLORS.muted);
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
