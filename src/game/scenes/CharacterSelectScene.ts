import Phaser from 'phaser';
import { DINOSAURS, DINO_ORDER, type DinoId } from '../../data/dinosaurs';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { loadSave } from '../core/Save';
import { formatTime } from '../../utils/math';
import { centerDesign } from '../ui/layout';
import { prefersTouch } from '../ui/TouchControls';
import { COLORS, FONT, FONT_BOLD, button, hex, text } from '../ui/theme';

const CARD_W = 360;
const CARD_H = 470;

export class CharacterSelectScene extends Phaser.Scene {
  private selected: DinoId = 'trex';
  private cards: { id: DinoId; bg: Phaser.GameObjects.Graphics; container: Phaser.GameObjects.Container; sprite: Phaser.GameObjects.Image }[] = [];

  constructor() {
    super('CharacterSelect');
  }

  create(): void {
    this.cards = [];
    this.selected = loadSave().lastDino ?? 'trex';
    centerDesign(this, [
      this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'ground').setAlpha(0.5),
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0c08, 0.55),
    ]);

    this.add.text(GAME_WIDTH / 2, 50, 'ESCOLHA SEU DINOSSAURO', {
      fontFamily: FONT_BOLD, fontSize: '40px', color: COLORS.accentText, stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5);

    const save = loadSave();
    DINO_ORDER.forEach((id, i) => {
      const x = GAME_WIDTH / 2 + (i - 1) * (CARD_W + 30);
      this.makeCard(id, x, 100 + CARD_H / 2, save.bestByDino[id]);
    });

    button(this, GAME_WIDTH / 2 + 130, GAME_HEIGHT - 50, 'INICIAR RUN', () => this.start(), { width: 280, height: 58, fontSize: 24 });
    button(this, GAME_WIDTH / 2 - 170, GAME_HEIGHT - 50, 'VOLTAR', () => this.scene.start('Menu'), { width: 180, height: 50, fontSize: 18, color: 0x7a8a6a });

    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => this.move(-1));
    kb.on('keydown-A', () => this.move(-1));
    kb.on('keydown-RIGHT', () => this.move(1));
    kb.on('keydown-D', () => this.move(1));
    kb.once('keydown-ENTER', () => this.start());
    kb.once('keydown-ESC', () => this.scene.start('Menu'));
    this.refresh();
    this.cameras.main.fadeIn(250);
  }

  private move(dir: number): void {
    const i = DINO_ORDER.indexOf(this.selected);
    this.selected = DINO_ORDER[(i + dir + DINO_ORDER.length) % DINO_ORDER.length];
    this.refresh();
  }

  private start(): void {
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Run', { dino: this.selected }));
  }

  private makeCard(id: DinoId, x: number, y: number, best?: number): void {
    const d = DINOSAURS[id];
    const bg = this.add.graphics();
    const sprite = this.add.image(0, -CARD_H / 2 + 80, d.texture).setScale(1.5).setRotation(-Math.PI / 2);
    const name = this.add.text(0, -CARD_H / 2 + 150, d.name, {
      fontFamily: FONT_BOLD, fontSize: '28px', color: '#ffffff', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);
    const title = text(this, 0, -CARD_H / 2 + 184, d.title, 16, hex(d.accentColor), true).setOrigin(0.5);
    const desc = this.add.text(0, -CARD_H / 2 + 210, d.description, {
      fontFamily: FONT, fontSize: '15px', color: COLORS.text, align: 'center', wordWrap: { width: CARD_W - 40 },
    }).setOrigin(0.5, 0);

    const bars = this.add.graphics();
    const labels: Phaser.GameObjects.Text[] = [];
    const rows: [string, number][] = [
      ['VIDA', d.display.health], ['VELOCIDADE', d.display.speed], ['DANO', d.display.damage], ['VEL. ATAQUE', d.display.attackSpeed],
    ];
    rows.forEach(([label, v], i) => {
      const ry = -CARD_H / 2 + 268 + i * 24;
      labels.push(text(this, -CARD_W / 2 + 24, ry - 9, label, 13, COLORS.muted, true));
      for (let b = 0; b < 5; b++) {
        bars.fillStyle(b < v ? d.accentColor : 0x30382a, 1);
        bars.fillRoundedRect(20 + b * 28, ry - 7, 24, 12, 3);
      }
    });

    const ab = text(this, 0, -CARD_H / 2 + 370, `${prefersTouch() ? 'HABILIDADE' : 'SPACE'} · ${d.abilityName.toUpperCase()}`, 15, COLORS.accentText, true).setOrigin(0.5);
    const abDesc = this.add.text(0, -CARD_H / 2 + 392, d.abilityDescription, {
      fontFamily: FONT, fontSize: '14px', color: '#d8d0b8', align: 'center', wordWrap: { width: CARD_W - 40 },
    }).setOrigin(0.5, 0);
    const builds = text(this, 0, CARD_H / 2 - 22, `Builds: ${d.builds.join(' · ')}${best ? `   ·   Recorde ${formatTime(best)}` : ''}`, 12, COLORS.muted).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, sprite, name, title, desc, bars, ...labels, ab, abDesc, builds]);
    container.setSize(CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => {
      if (this.selected === id) this.start();
      else {
        this.selected = id;
        this.refresh();
      }
    });
    this.cards.push({ id, bg, container, sprite });
  }

  private refresh(): void {
    for (const c of this.cards) {
      const d = DINOSAURS[c.id];
      const sel = c.id === this.selected;
      c.bg.clear();
      c.bg.fillStyle(0x000000, 0.5);
      c.bg.fillRoundedRect(-CARD_W / 2 + 6, -CARD_H / 2 + 8, CARD_W, CARD_H, 16);
      c.bg.fillStyle(sel ? 0x2a3222 : COLORS.panel, 1);
      c.bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 16);
      c.bg.fillStyle(d.color, sel ? 0.3 : 0.12);
      c.bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, 130, { tl: 16, tr: 16, bl: 0, br: 0 });
      c.bg.lineStyle(sel ? 5 : 2, sel ? COLORS.accent : COLORS.border, 1);
      c.bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 16);
      this.tweens.killTweensOf(c.container);
      this.tweens.add({ targets: c.container, scale: sel ? 1.03 : 0.95, alpha: sel ? 1 : 0.75, duration: 150 });
      this.tweens.killTweensOf(c.sprite);
      c.sprite.setRotation(-Math.PI / 2);
      if (sel) this.tweens.add({ targets: c.sprite, rotation: -Math.PI / 2 + 0.12, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.easeInOut' });
    }
  }
}
