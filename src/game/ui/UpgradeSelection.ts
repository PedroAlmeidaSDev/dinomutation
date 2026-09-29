import Phaser from 'phaser';
import { TAG_COLORS, TAG_LABELS } from '../../data/upgrades';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { designOffset, fitShade } from './layout';
import type { UpgradeChoice } from '../upgrades/UpgradeSystem';
import { COLORS, FONT, RARITY_COLORS, RARITY_LABELS, WEIGHT, button, drawPanel, drawTagIcon, hex, text, title } from './theme';

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

    this.shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.8).setOrigin(0).setInteractive();
    objs.push(this.shade);
    const heading = title(scene, GAME_WIDTH / 2, 70, opts.title, 40).setOrigin(0.5);
    objs.push(heading, text(scene, GAME_WIDTH / 2, 116, opts.subtitle, 17, COLORS.muted).setOrigin(0.5));

    const n = opts.choices.length;
    opts.choices.forEach((choice, i) => {
      const x = GAME_WIDTH / 2 + (i - (n - 1) / 2) * (CARD_W + 36);
      objs.push(this.makeCard(choice, i, x, 150 + CARD_H / 2));
    });

    if (opts.rerolls > 0) {
      objs.push(button(scene, GAME_WIDTH / 2, GAME_HEIGHT - 60, `REROLAR (R) · ${opts.rerolls}`, () => this.reroll(), {
        width: 260, height: 46, fontSize: 17, ghost: true,
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
      drawPanel(bg, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, {
        cut: 16, fill: hover ? COLORS.panelLight : COLORS.panel, alpha: 0.96,
        stroke: hover ? rc : COLORS.border, strokeWidth: hover ? 2 : 1, accent: rc,
      });
    };
    drawBg(false);

    const icon = s.add.graphics();
    const my = -CARD_H / 2 + 64;
    icon.fillStyle(COLORS.bg, 1);
    icon.fillCircle(0, my, 38);
    icon.lineStyle(2, iconColor, 0.8);
    icon.strokeCircle(0, my, 38);
    drawTagIcon(icon, iconTag, 0, my, 44, iconColor);

    const keyBadge = s.add.graphics();
    drawPanel(keyBadge, -CARD_W / 2 + 14, -CARD_H / 2 + 14, 28, 28, { cut: 6, fill: COLORS.bg, stroke: COLORS.border });
    const keyHint = text(s, -CARD_W / 2 + 28, -CARD_H / 2 + 28, `${index + 1}`, 15, COLORS.muted, true).setOrigin(0.5);
    const levelLabel = choice.nextLevel === 1
      ? 'NOVO'
      : `NV ${choice.nextLevel - 1} → ${choice.nextLevel}`;
    const lvl = text(s, CARD_W / 2 - 16, -CARD_H / 2 + 18, def.consumable ? '' : levelLabel, 13, choice.nextLevel === 1 ? COLORS.acidText : COLORS.accentText, true).setOrigin(1, 0);

    const name = s.add.text(0, -CARD_H / 2 + 128, def.name.toUpperCase(), {
      fontFamily: FONT, fontStyle: WEIGHT.bold, fontSize: '22px', color: COLORS.text, letterSpacing: 1,
      align: 'center', wordWrap: { width: CARD_W - 30 },
    }).setOrigin(0.5, 0);
    const rarityY = name.y + name.height + 4;
    const rarity = text(s, 0, rarityY + 10, RARITY_LABELS[def.rarity], 12, hex(rc), true).setOrigin(0.5).setLetterSpacing(3);
    const desc = s.add.text(0, rarityY + 34, def.description, {
      fontFamily: FONT, fontStyle: WEIGHT.regular, fontSize: '16px', color: COLORS.muted, align: 'center',
      wordWrap: { width: CARD_W - 36 }, lineSpacing: 4,
    }).setOrigin(0.5, 0);

    const tagStr = def.tags.map((t) => TAG_LABELS[t] ?? t.toUpperCase()).join(' • ');
    const tags = text(s, 0, CARD_H / 2 - 58, tagStr, 13, hex(iconColor), true).setOrigin(0.5);
    const syn = text(s, 0, CARD_H / 2 - 30, synergy.length ? `✦ SINERGIA: ${synergy.map((t) => TAG_LABELS[t] ?? t).join(', ')}` : '', 12, COLORS.acidText, true).setOrigin(0.5);

    const card = s.add.container(x, y, [bg, icon, keyBadge, keyHint, lvl, name, rarity, desc, tags, syn]);
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
