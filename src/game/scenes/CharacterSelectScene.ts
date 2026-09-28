import Phaser from 'phaser';
import { DINOSAURS, DINO_ORDER, type DinoId } from '../../data/dinosaurs';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { loadSave } from '../core/Save';
import { formatTime } from '../../utils/math';
import { centerDesign } from '../ui/layout';
import { prefersTouch } from '../ui/TouchControls';
import { COLORS, FONT, FONT_BOLD, button, drawSlab, hex, shade, text, title } from '../ui/theme';

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

    title(this, GAME_WIDTH / 2, 50, 'ESCOLHA SEU DINOSSAURO', 44).setOrigin(0.5);

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
    const sprite = this.add.image(0, -CARD_H / 2 + 72, d.texture);
    // Sprites are long (tails): show them side-on, fitted to the card's header.
    sprite.setScale(Math.min(1.6, (CARD_W - 60) / sprite.width, 110 / sprite.height));
    const name = this.add.text(0, -CARD_H / 2 + 152, d.name, {
      fontFamily: FONT_BOLD, fontSize: '30px', color: '#ffffff', stroke: '#1a0e04', strokeThickness: 7,
      shadow: { offsetX: 0, offsetY: 3, color: '#000000', blur: 0, stroke: true, fill: true },
    }).setOrigin(0.5);
    const title = text(this, 0, -CARD_H / 2 + 184, d.title, 16, hex(d.accentColor), true).setOrigin(0.5);
    const desc = this.add.text(0, -CARD_H / 2 + 210, d.description, {
      fontFamily: FONT, fontStyle: 'bold', fontSize: '15px', color: COLORS.text, align: 'center', wordWrap: { width: CARD_W - 40 },
    }).setOrigin(0.5, 0);

    const bars = this.add.graphics();
    const pedestal = this.add.graphics();
    pedestal.fillStyle(0x000000, 0.35);
    pedestal.fillEllipse(0, -CARD_H / 2 + 88, CARD_W - 70, 46);
    pedestal.lineStyle(3, d.color, 0.6);
    pedestal.strokeEllipse(0, -CARD_H / 2 + 88, CARD_W - 70, 46);
    const labels: Phaser.GameObjects.Text[] = [];
    const rows: [string, number][] = [
      ['VIDA', d.display.health], ['VELOCIDADE', d.display.speed], ['DANO', d.display.damage], ['VEL. ATAQUE', d.display.attackSpeed],
    ];
    rows.forEach(([label, v], i) => {
      const ry = -CARD_H / 2 + 268 + i * 24;
      labels.push(text(this, -CARD_W / 2 + 24, ry - 9, label, 13, COLORS.muted, true));
      for (let b = 0; b < 5; b++) {
        const px = 20 + b * 28;
        bars.fillStyle(COLORS.outline, 1);
        bars.fillRoundedRect(px - 2, ry - 9, 28, 16, 5);
        bars.fillStyle(b < v ? shade(d.accentColor, -20) : 0x1e1b15, 1);
        bars.fillRoundedRect(px, ry - 7, 24, 12, 3);
        if (b < v) {
          bars.fillStyle(d.accentColor, 1);
          bars.fillRoundedRect(px, ry - 7, 24, 8, 3);
          bars.fillStyle(0xffffff, 0.35);
          bars.fillRect(px + 3, ry - 5, 18, 2);
        }
      }
    });

    const ab = text(this, 0, -CARD_H / 2 + 370, `${prefersTouch() ? 'HABILIDADE' : 'SPACE'} · ${d.abilityName.toUpperCase()}`, 15, COLORS.accentText, true).setOrigin(0.5);
    const abDesc = this.add.text(0, -CARD_H / 2 + 392, d.abilityDescription, {
      fontFamily: FONT, fontStyle: 'bold', fontSize: '14px', color: '#d8d0b8', align: 'center', wordWrap: { width: CARD_W - 40 },
    }).setOrigin(0.5, 0);
    const builds = text(this, 0, CARD_H / 2 - 22, `Builds: ${d.builds.join(' · ')}${best ? `   ·   Recorde ${formatTime(best)}` : ''}`, 12, COLORS.muted).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, pedestal, sprite, name, title, desc, bars, ...labels, ab, abDesc, builds]);
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
      if (sel) {
        // Gold halo behind the selected card.
        c.bg.fillStyle(COLORS.accent, 0.35);
        c.bg.fillRoundedRect(-CARD_W / 2 - 10, -CARD_H / 2 - 10, CARD_W + 20, CARD_H + 20, 24);
      }
      drawSlab(c.bg, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, {
        fill: sel ? COLORS.panelLight : COLORS.panel, radius: 18, border: 5, speckle: true, shadow: 8,
        frame: sel ? COLORS.accent : undefined, frameWidth: 4,
      });
      // Header band tinted with the dinosaur's colour.
      c.bg.fillStyle(d.color, sel ? 0.4 : 0.2);
      c.bg.fillRoundedRect(-CARD_W / 2 + 9, -CARD_H / 2 + 9, CARD_W - 18, 122, { tl: 12, tr: 12, bl: 0, br: 0 });
      c.bg.fillStyle(COLORS.outline, 1);
      c.bg.fillRect(-CARD_W / 2 + 9, -CARD_H / 2 + 131, CARD_W - 18, 3);
      this.tweens.killTweensOf(c.container);
      this.tweens.add({ targets: c.container, scale: sel ? 1.03 : 0.95, alpha: sel ? 1 : 0.75, duration: 150 });
      this.tweens.killTweensOf(c.sprite);
      c.sprite.setRotation(0);
      if (sel) this.tweens.add({ targets: c.sprite, rotation: 0.08, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.easeInOut' });
    }
  }
}
