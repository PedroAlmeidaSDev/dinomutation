import Phaser from 'phaser';
import { TAG_COLORS, TAG_LABELS } from '../../data/upgrades';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { designOffset, fitShade } from './layout';
import type { UpgradeChoice } from '../upgrades/UpgradeSystem';
import { COLORS, FONT, FONT_BOLD, RARITY_COLORS, RARITY_LABELS, button, drawSlab, drawTagIcon, hex, shade, text, title } from './theme';

export interface SelectionOptions {
  title: string;
  subtitle: string;
  choices: UpgradeChoice[];
  /** Tags already in the build — matching tags are highlighted as synergies. */
  buildTags: Set<string>;
  rerolls: number;
  onPick: (choice: UpgradeChoice) => void;
  onReroll: () => void;
}

const CARD_W = 300;
const CARD_H = 390;

/** Level-up screen: three mutation cards (click or keys 1-3), optional reroll (R). */
export class UpgradeSelection {
  private readonly root: Phaser.GameObjects.Container;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private keyHandler?: (e: KeyboardEvent) => void;
  private closed = false;
  private readyAt: number;

  constructor(private readonly scene: Phaser.Scene, private readonly opts: SelectionOptions) {
    this.readyAt = scene.time.now + 280;
    const objs: Phaser.GameObjects.GameObject[] = [];

    this.shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070a, 0.72).setOrigin(0).setInteractive();
    objs.push(this.shade);
    const heading = title(scene, GAME_WIDTH / 2, 70, opts.title, 46).setOrigin(0.5);
    objs.push(heading, text(scene, GAME_WIDTH / 2, 116, opts.subtitle, 17, COLORS.muted).setOrigin(0.5));

    const n = opts.choices.length;
    opts.choices.forEach((choice, i) => {
      const x = GAME_WIDTH / 2 + (i - (n - 1) / 2) * (CARD_W + 36);
      objs.push(this.makeCard(choice, i, x, 150 + CARD_H / 2));
    });

    if (opts.rerolls > 0) {
      objs.push(button(scene, GAME_WIDTH / 2, GAME_HEIGHT - 60, `REROLAR (R) · ${opts.rerolls}`, () => this.reroll(), {
        width: 260, height: 46, fontSize: 18, color: 0x7a8a6a,
      }));
    }

    this.root = scene.add.container(0, 0, objs).setDepth(1000);
    this.layout();
    this.root.setAlpha(0);
    scene.tweens.add({ targets: this.root, alpha: 1, duration: 160 });

    this.keyHandler = (e: KeyboardEvent) => {
      const idx = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3;
      if (idx >= 0 && e.code.match(/[123]$/) && idx < this.opts.choices.length) this.pick(this.opts.choices[idx]);
      else if (e.code === 'KeyR' && this.opts.rerolls > 0) this.reroll();
    };
    scene.input.keyboard?.on('keydown', this.keyHandler);
  }

  /** Centres the cards in the current screen; the shade covers all of it. */
  layout(): void {
    if (this.closed) return;
    const o = designOffset(this.scene);
    this.root.setPosition(o.x, o.y);
    fitShade(this.shade, this.scene);
  }

  private makeCard(choice: UpgradeChoice, index: number, x: number, y: number): Phaser.GameObjects.Container {
    const s = this.scene;
    const def = choice.def;
    const rc = RARITY_COLORS[def.rarity];
    const iconTag = def.icon ?? def.tags[0];
    const iconColor = TAG_COLORS[iconTag] ?? 0xffffff;
    const synergy = def.tags.filter((t) => this.opts.buildTags.has(t) && !['physical', 'utility', 'health', 'multi'].includes(t));

    const bg = s.add.graphics();
    const drawBg = (hover: boolean) => {
      bg.clear();
      if (def.rarity !== 'common' || hover) {
        bg.fillStyle(rc, hover ? 0.4 : 0.22);
        bg.fillRoundedRect(-CARD_W / 2 - 10, -CARD_H / 2 - 10, CARD_W + 20, CARD_H + 20, 24);
      }
      drawSlab(bg, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, {
        fill: hover ? COLORS.panelLight : COLORS.panel, radius: 18, border: 5, speckle: true, shadow: 8, frame: rc, frameWidth: hover ? 5 : 4,
      });
      bg.fillStyle(rc, 0.2);
      bg.fillRoundedRect(-CARD_W / 2 + 9, -CARD_H / 2 + 9, CARD_W - 18, 112, { tl: 12, tr: 12, bl: 0, br: 0 });
    };
    drawBg(false);

    const icon = s.add.graphics();
    // Stone medallion: outline, rim, dark face, coloured ring.
    const my = -CARD_H / 2 + 64;
    icon.fillStyle(0x000000, 0.35);
    icon.fillCircle(2, my + 5, 46);
    icon.fillStyle(COLORS.outline, 1);
    icon.fillCircle(0, my, 46);
    icon.fillStyle(0x5a5242, 1);
    icon.fillCircle(0, my, 42);
    icon.fillStyle(0x17140f, 1);
    icon.fillCircle(0, my, 35);
    icon.lineStyle(3, iconColor, 0.9);
    icon.strokeCircle(0, my, 35);
    icon.fillStyle(0xffffff, 0.15);
    icon.slice(0, my, 42, Math.PI * 1.1, Math.PI * 1.9, false);
    icon.fillPath();
    drawTagIcon(icon, iconTag, 0, my, 44, iconColor);

    const keyBadge = s.add.graphics();
    drawSlab(keyBadge, -CARD_W / 2 + 12, -CARD_H / 2 + 12, 34, 34, { fill: COLORS.panelLight, radius: 9, border: 3, shadow: 0, lip: 3 });
    const keyHint = text(s, -CARD_W / 2 + 29, -CARD_H / 2 + 27, `${index + 1}`, 18, '#ffffff', true).setOrigin(0.5);
    const levelLabel = choice.nextLevel === 1
      ? 'NOVO'
      : `NV ${choice.nextLevel - 1} → ${choice.nextLevel}`;
    const lvl = text(s, CARD_W / 2 - 16, -CARD_H / 2 + 16, def.consumable ? '' : levelLabel, 14, choice.nextLevel === 1 ? '#8aff9a' : '#ffe08a', true).setOrigin(1, 0);

    const name = s.add.text(0, -CARD_H / 2 + 130, def.name.toUpperCase(), {
      fontFamily: FONT_BOLD, fontSize: '23px', color: '#ffffff', stroke: '#1a0e04', strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 0, stroke: true, fill: true },
      align: 'center', wordWrap: { width: CARD_W - 30 },
    }).setOrigin(0.5, 0);
    // Rarity ribbon: a small slab in the rarity colour.
    const rarityY = name.y + name.height + 4;
    const rarity = text(s, 0, rarityY + 12, RARITY_LABELS[def.rarity], 13, '#ffffff', true).setOrigin(0.5);
    const ribbon = s.add.graphics();
    drawSlab(ribbon, -rarity.width / 2 - 16, rarityY, rarity.width + 32, 26, { fill: shade(rc, -25), radius: 13, border: 3, shadow: 3 });
    const desc = s.add.text(0, rarityY + 38, def.description, {
      fontFamily: FONT, fontStyle: 'bold', fontSize: '16px', color: COLORS.text, align: 'center',
      wordWrap: { width: CARD_W - 36 }, lineSpacing: 4,
    }).setOrigin(0.5, 0);

    const tagStr = def.tags.map((t) => TAG_LABELS[t] ?? t.toUpperCase()).join(' • ');
    const tags = text(s, 0, CARD_H / 2 - 58, tagStr, 13, hex(iconColor), true).setOrigin(0.5);
    const syn = text(s, 0, CARD_H / 2 - 30, synergy.length ? `✦ SINERGIA: ${synergy.map((t) => TAG_LABELS[t] ?? t).join(', ')}` : '', 12, '#9affc0', true).setOrigin(0.5);

    const card = s.add.container(x, y, [bg, icon, keyBadge, keyHint, lvl, name, ribbon, rarity, desc, tags, syn]);
    card.setSize(CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    card.setScale(0.6).setAlpha(0);
    s.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 260, delay: 60 + index * 70, ease: 'Back.easeOut' });
    if (def.rarity === 'legendary') {
      s.tweens.add({ targets: bg, alpha: { from: 1, to: 0.8 }, yoyo: true, repeat: -1, duration: 500 });
    }
    card.on('pointerover', () => { drawBg(true); s.tweens.add({ targets: card, y: y - 10, duration: 100 }); });
    card.on('pointerout', () => { drawBg(false); s.tweens.add({ targets: card, y, duration: 100 }); });
    card.on('pointerdown', () => this.pick(choice));
    return card;
  }

  private pick(choice: UpgradeChoice): void {
    if (this.closed || this.scene.time.now < this.readyAt) return;
    this.close();
    this.opts.onPick(choice);
  }

  private reroll(): void {
    if (this.closed || this.scene.time.now < this.readyAt) return;
    this.close();
    this.opts.onReroll();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.keyHandler) this.scene.input.keyboard?.off('keydown', this.keyHandler);
    this.root.destroy();
  }
}
