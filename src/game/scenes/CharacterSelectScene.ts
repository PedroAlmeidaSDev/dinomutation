import Phaser from 'phaser';
import { DIFFICULTIES, DIFFICULTY_BY_ID, difficultyIndex, highestUnlocked, type DifficultyId } from '../../data/difficulty';
import { DINOSAURS, DINO_ORDER, type DinoId } from '../../data/dinosaurs';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { clearedIndex, loadSave, preferredDifficulty, rememberDifficulty, type SaveData } from '../core/Save';
import { masteryLevel } from '../../data/meta';
import { formatTime } from '../../utils/math';
import { centerDesign } from '../ui/layout';
import { prefersTouch } from '../ui/TouchControls';
import { COLORS, FONT, WEIGHT, button, drawPanel, hex, text, title } from '../ui/theme';

const CARD_W = 360;
const CARD_H = 470;

export class CharacterSelectScene extends Phaser.Scene {
  private selected: DinoId = 'trex';
  private difficulty: DifficultyId = 'filhote';
  private save!: SaveData;
  private diffName!: Phaser.GameObjects.Text;
  private diffInfo!: Phaser.GameObjects.Text;
  private diffArrows: Phaser.GameObjects.Text[] = [];
  private cards: { id: DinoId; bg: Phaser.GameObjects.Graphics; container: Phaser.GameObjects.Container; sprite: Phaser.GameObjects.Image }[] = [];

  constructor() {
    super('CharacterSelect');
  }

  create(data?: { dino?: DinoId }): void {
    this.cards = [];
    this.save = loadSave();
    this.selected = data?.dino ?? this.save.lastDino ?? 'trex';
    this.difficulty = preferredDifficulty(this.save, this.selected);
    centerDesign(this, [
      this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'ground').setAlpha(0.5),
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.75),
    ]);

    title(this, GAME_WIDTH / 2, 50, 'ESCOLHA SEU DINOSSAURO', 38).setOrigin(0.5);

    const save = this.save;
    DINO_ORDER.forEach((id, i) => {
      const x = GAME_WIDTH / 2 + (i - 1) * (CARD_W + 30);
      this.makeCard(id, x, 100 + CARD_H / 2, save.bestByDino[id], masteryLevel(save.mastery[id] ?? 0));
    });

    // Difficulty selector (per dinosaur): ◀ NAME ▶ + description / next unlock.
    const dy = 598;
    const arrow = (x: number, label: string, dir: number) => text(this, x, dy, label, 24, COLORS.accentText, true)
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.cycleDifficulty(dir));
    this.diffArrows = [arrow(GAME_WIDTH / 2, '◀', -1), arrow(GAME_WIDTH / 2, '▶', 1)];
    this.diffName = this.add.text(GAME_WIDTH / 2, dy, '', {
      fontFamily: FONT, fontStyle: WEIGHT.bold, fontSize: '22px', color: COLORS.text, letterSpacing: 2,
    }).setOrigin(0.5);
    this.diffInfo = text(this, GAME_WIDTH / 2, dy + 24, '', 13, COLORS.muted, true).setOrigin(0.5);

    button(this, GAME_WIDTH / 2 + 130, GAME_HEIGHT - 50, 'INICIAR RUN', () => this.start(), { width: 280, height: 58, fontSize: 24 });
    button(this, GAME_WIDTH / 2 - 170, GAME_HEIGHT - 50, 'VOLTAR', () => this.scene.start('Menu'), { width: 180, height: 50, fontSize: 18, ghost: true });

    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => this.move(-1));
    kb.on('keydown-A', () => this.move(-1));
    kb.on('keydown-RIGHT', () => this.move(1));
    kb.on('keydown-D', () => this.move(1));
    kb.on('keydown-UP', () => this.cycleDifficulty(1));
    kb.on('keydown-W', () => this.cycleDifficulty(1));
    kb.on('keydown-DOWN', () => this.cycleDifficulty(-1));
    kb.on('keydown-S', () => this.cycleDifficulty(-1));
    kb.once('keydown-ENTER', () => this.start());
    kb.once('keydown-ESC', () => this.scene.start('Menu'));
    this.refresh();
    this.cameras.main.fadeIn(250);
  }

  private move(dir: number): void {
    const i = DINO_ORDER.indexOf(this.selected);
    this.selected = DINO_ORDER[(i + dir + DINO_ORDER.length) % DINO_ORDER.length];
    this.difficulty = preferredDifficulty(this.save, this.selected);
    this.refresh();
  }

  /** Cycles through the difficulties unlocked for the selected dinosaur. */
  private cycleDifficulty(dir: number): void {
    const count = highestUnlocked(clearedIndex(this.save, this.selected)) + 1;
    const i = difficultyIndex(this.difficulty);
    this.difficulty = DIFFICULTIES[(i + dir + count) % count].id;
    this.save.difficulty[this.selected] = this.difficulty;
    this.refreshDifficulty();
  }

  private refreshDifficulty(): void {
    const d = DIFFICULTY_BY_ID[this.difficulty];
    const cleared = clearedIndex(this.save, this.selected);
    const unlocked = highestUnlocked(cleared);
    const beaten = difficultyIndex(d.id) <= cleared;
    this.diffName.setText(`DIFICULDADE: ${d.name.toUpperCase()}${beaten ? '  ✓' : ''}`).setColor(hex(d.color));
    // Arrows hug the name; hidden when only one difficulty is unlocked.
    const gap = this.diffName.width / 2 + 26;
    this.diffArrows[0].setX(GAME_WIDTH / 2 - gap).setVisible(unlocked > 0);
    this.diffArrows[1].setX(GAME_WIDTH / 2 + gap).setVisible(unlocked > 0);
    const next = DIFFICULTIES[unlocked + 1];
    const reward = beaten ? `Fósseis ×${d.fossilMult.toLocaleString('pt-BR')}` : `Fósseis ×${d.fossilMult.toLocaleString('pt-BR')} · 1ª vitória: +${d.firstWinBonus}`;
    const lock = next ? `   ·   Vença ${DIFFICULTIES[unlocked].name} para liberar ${next.name}` : '';
    this.diffInfo.setText(`${d.description}  ${reward}${lock}`);
  }

  private start(): void {
    rememberDifficulty(this.selected, this.difficulty);
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Run', { dino: this.selected, difficulty: this.difficulty }));
  }

  private makeCard(id: DinoId, x: number, y: number, best: number | undefined, mastery: number): void {
    const d = DINOSAURS[id];
    const bg = this.add.graphics();
    const sprite = this.add.image(0, -CARD_H / 2 + 72, d.texture);
    // Sprites are long (tails): show them side-on, fitted to the card's header.
    sprite.setScale(Math.min(1.6, (CARD_W - 60) / sprite.width, 110 / sprite.height));
    const name = title(this, 0, -CARD_H / 2 + 152, d.name, 30).setOrigin(0.5);
    const subtitle = text(this, 0, -CARD_H / 2 + 184, `${d.title}  ·  Maestria ${mastery}`, 16, hex(d.accentColor), true).setOrigin(0.5);
    const desc = this.add.text(0, -CARD_H / 2 + 210, d.description, {
      fontFamily: FONT, fontStyle: WEIGHT.regular, fontSize: '15px', color: COLORS.text, align: 'center', wordWrap: { width: CARD_W - 40 },
    }).setOrigin(0.5, 0);

    const bars = this.add.graphics();
    const pedestal = this.add.graphics();
    pedestal.fillStyle(0x000000, 0.25);
    pedestal.fillEllipse(0, -CARD_H / 2 + 90, CARD_W - 90, 36);
    const labels: Phaser.GameObjects.Text[] = [];
    const rows: [string, number][] = [
      ['VIDA', d.display.health], ['VELOCIDADE', d.display.speed], ['DANO', d.display.damage], ['VEL. ATAQUE', d.display.attackSpeed],
    ];
    rows.forEach(([label, v], i) => {
      const ry = -CARD_H / 2 + 268 + i * 24;
      labels.push(text(this, -CARD_W / 2 + 24, ry - 9, label, 13, COLORS.muted, true));
      for (let b = 0; b < 5; b++) {
        bars.fillStyle(b < v ? d.accentColor : COLORS.track, 1);
        bars.fillRect(20 + b * 28, ry - 4, 24, 6);
      }
    });

    const ab = text(this, 0, -CARD_H / 2 + 370, `${prefersTouch() ? 'HABILIDADE' : 'SPACE'} · ${d.abilityName.toUpperCase()}`, 15, COLORS.accentText, true).setOrigin(0.5);
    const abDesc = this.add.text(0, -CARD_H / 2 + 392, d.abilityDescription, {
      fontFamily: FONT, fontStyle: WEIGHT.regular, fontSize: '14px', color: COLORS.muted, align: 'center', wordWrap: { width: CARD_W - 40 },
    }).setOrigin(0.5, 0);
    const builds = text(this, 0, CARD_H / 2 - 22, `Builds: ${d.builds.join(' · ')}${best ? `   ·   Recorde ${formatTime(best)}` : ''}`, 12, COLORS.muted).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, pedestal, sprite, name, subtitle, desc, bars, ...labels, ab, abDesc, builds]);
    container.setSize(CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => {
      if (this.selected === id) this.start();
      else {
        this.selected = id;
        this.difficulty = preferredDifficulty(this.save, id);
        this.refresh();
      }
    });
    this.cards.push({ id, bg, container, sprite });
  }

  private refresh(): void {
    this.refreshDifficulty();
    for (const c of this.cards) {
      const d = DINOSAURS[c.id];
      const sel = c.id === this.selected;
      c.bg.clear();
      drawPanel(c.bg, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, {
        cut: 16, fill: sel ? COLORS.panelLight : COLORS.panel,
        stroke: sel ? COLORS.accent : COLORS.border, strokeWidth: sel ? 2 : 1, accent: sel ? d.accentColor : undefined,
      });
      c.bg.fillStyle(COLORS.border, 1);
      c.bg.fillRect(-CARD_W / 2 + 20, -CARD_H / 2 + 128, CARD_W - 40, 1);
      this.tweens.killTweensOf(c.container);
      this.tweens.add({ targets: c.container, scale: sel ? 1.03 : 0.95, alpha: sel ? 1 : 0.75, duration: 150 });
      this.tweens.killTweensOf(c.sprite);
      c.sprite.setRotation(0);
      if (sel) this.tweens.add({ targets: c.sprite, rotation: 0.08, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.easeInOut' });
    }
  }
}
