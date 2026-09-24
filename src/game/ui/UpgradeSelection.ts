import Phaser from 'phaser';
import { TAG_COLORS, TAG_LABELS } from '../../data/upgrades';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { UpgradeChoice } from '../upgrades/UpgradeSystem';
import { COLORS, FONT, FONT_BOLD, RARITY_COLORS, RARITY_LABELS, button, drawTagIcon, hex, text } from './theme';

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
  private keyHandler?: (e: KeyboardEvent) => void;
  private closed = false;
  private readyAt: number;

  constructor(private readonly scene: Phaser.Scene, private readonly opts: SelectionOptions) {
    this.readyAt = scene.time.now + 280;
    const objs: Phaser.GameObjects.GameObject[] = [];

    const shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070a, 0.72).setOrigin(0).setInteractive();
    objs.push(shade);
    const title = scene.add.text(GAME_WIDTH / 2, 70, opts.title, {
      fontFamily: FONT_BOLD, fontSize: '42px', color: COLORS.accentText, stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5);
    objs.push(title, text(scene, GAME_WIDTH / 2, 116, opts.subtitle, 17, COLORS.muted).setOrigin(0.5));

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
    this.root.setAlpha(0);
    scene.tweens.add({ targets: this.root, alpha: 1, duration: 160 });

    this.keyHandler = (e: KeyboardEvent) => {
      const idx = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3;
      if (idx >= 0 && e.code.match(/[123]$/) && idx < this.opts.choices.length) this.pick(this.opts.choices[idx]);
      else if (e.code === 'KeyR' && this.opts.rerolls > 0) this.reroll();
    };
    scene.input.keyboard?.on('keydown', this.keyHandler);
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
      if (def.rarity !== 'common') {
        bg.fillStyle(rc, hover ? 0.35 : 0.2);
        bg.fillRoundedRect(-CARD_W / 2 - 8, -CARD_H / 2 - 8, CARD_W + 16, CARD_H + 16, 18);
      }
      bg.fillStyle(0x000000, 0.5);
      bg.fillRoundedRect(-CARD_W / 2 + 6, -CARD_H / 2 + 8, CARD_W, CARD_H, 14);
      bg.fillStyle(hover ? COLORS.panelLight : COLORS.panel, 1);
      bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 14);
      bg.fillStyle(rc, 0.18);
      bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, 120, { tl: 14, tr: 14, bl: 0, br: 0 });
      bg.lineStyle(hover ? 5 : 3, rc, 1);
      bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 14);
    };
    drawBg(false);

    const icon = s.add.graphics();
    icon.fillStyle(0x000000, 0.45);
    icon.fillCircle(0, -CARD_H / 2 + 62, 40);
    icon.lineStyle(3, iconColor, 0.9);
    icon.strokeCircle(0, -CARD_H / 2 + 62, 40);
    drawTagIcon(icon, iconTag, 0, -CARD_H / 2 + 62, 46, iconColor);

    const keyHint = text(s, -CARD_W / 2 + 14, -CARD_H / 2 + 10, `${index + 1}`, 18, '#ffffff', true);
    const levelLabel = choice.nextLevel === 1
      ? 'NOVO'
      : `NV ${choice.nextLevel - 1} → ${choice.nextLevel}`;
    const lvl = text(s, CARD_W / 2 - 14, -CARD_H / 2 + 12, def.consumable ? '' : levelLabel, 14, choice.nextLevel === 1 ? '#8aff9a' : '#ffe08a', true).setOrigin(1, 0);

    const name = s.add.text(0, -CARD_H / 2 + 128, def.name.toUpperCase(), {
      fontFamily: FONT_BOLD, fontSize: '21px', color: '#ffffff', stroke: '#000000', strokeThickness: 5,
      align: 'center', wordWrap: { width: CARD_W - 30 },
    }).setOrigin(0.5, 0);
    const rarityY = name.y + name.height + 2;
    const rarity = text(s, 0, rarityY, RARITY_LABELS[def.rarity], 14, hex(rc), true).setOrigin(0.5, 0);
    const desc = s.add.text(0, rarityY + 30, def.description, {
      fontFamily: FONT, fontSize: '16px', color: COLORS.text, align: 'center',
      wordWrap: { width: CARD_W - 36 }, lineSpacing: 4,
    }).setOrigin(0.5, 0);

    const tagStr = def.tags.map((t) => TAG_LABELS[t] ?? t.toUpperCase()).join(' • ');
    const tags = text(s, 0, CARD_H / 2 - 58, tagStr, 13, hex(iconColor), true).setOrigin(0.5);
    const syn = text(s, 0, CARD_H / 2 - 30, synergy.length ? `✦ SINERGIA: ${synergy.map((t) => TAG_LABELS[t] ?? t).join(', ')}` : '', 12, '#9affc0', true).setOrigin(0.5);

    const card = s.add.container(x, y, [bg, icon, keyHint, lvl, name, rarity, desc, tags, syn]);
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
