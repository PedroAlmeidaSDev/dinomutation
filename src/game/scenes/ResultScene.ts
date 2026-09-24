import Phaser from 'phaser';
import { DINOSAURS } from '../../data/dinosaurs';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { RunState } from '../core/RunState';
import { recordRun } from '../core/Save';
import { formatTime } from '../../utils/math';
import { COLORS, FONT_BOLD, RARITY_COLORS, button, hex, text } from '../ui/theme';
import type { Rarity } from '../../data/balance';

/** Shared end-of-run screen; GameOverScene and VictoryScene only change the mood. */
export abstract class ResultScene extends Phaser.Scene {
  protected abstract readonly victory: boolean;

  create(data: { state: RunState }): void {
    const s = data.state;
    // s.victory: the story boss died (a death later in the endless mode still counts as a win).
    const save = recordRun(s.dinosaur, s.elapsedTime, s.victory, s.endless ? s.era : 0);
    const dino = DINOSAURS[s.dinosaur];

    this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'ground').setOrigin(0).setAlpha(0.4);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, this.victory ? 0x1a1408 : 0x1a0808, 0.75).setOrigin(0);

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
        x: { min: -GAME_WIDTH / 2, max: GAME_WIDTH / 2 }, speedY: { min: 80, max: 200 }, speedX: { min: -40, max: 40 },
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

    text(this, 620, 186, `MUTAÇÕES (${s.upgrades.length})`, 18, COLORS.accentText, true);
    if (s.upgrades.length === 0) text(this, 620, 222, 'Nenhuma.', 16, COLORS.muted);
    s.upgrades.forEach((u, i) => {
      const col = Math.floor(i / 12);
      const row = i % 12;
      text(this, 620 + col * 255, 220 + row * 27, `${u.name}${u.level > 1 ? ` ${u.level}` : ''}`, 15, hex(RARITY_COLORS[u.rarity as Rarity] ?? 0xffffff), true);
    });

    if (s.endless && s.mutations.length) {
      text(this, GAME_WIDTH / 2, 582, `MUTAÇÕES DE ERA: ${s.mutations.join(' · ')}`, 15, '#e0a0ff', true).setOrigin(0.5, 0);
    }

    button(this, GAME_WIDTH / 2 - 150, GAME_HEIGHT - 80, 'JOGAR NOVAMENTE', () => this.scene.start('Run', { dino: s.dinosaur }), { width: 280 });
    button(this, GAME_WIDTH / 2 + 150, GAME_HEIGHT - 80, 'MENU', () => this.scene.start('Menu'), { width: 220, color: 0x7a8a6a });
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('Run', { dino: s.dinosaur }));
    this.cameras.main.fadeIn(400);
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
