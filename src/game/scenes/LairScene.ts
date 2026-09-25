import Phaser from 'phaser';
import { DINOSAURS, DINO_ORDER, type DinoId } from '../../data/dinosaurs';
import {
  ABILITY_MASTERY, ABILITY_MAX_RANK, PASSIVES, SHOP, abilityMasteryRank, masteryFor, masteryProgress, passiveRank, roman, type ShopItemDef,
} from '../../data/meta';
import { DEBUG, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { debugGrant, loadSave, purchase, purchaseStatus, shopLevel, type SaveData } from '../core/Save';
import { COLORS, FONT_BOLD, button, hex, text } from '../ui/theme';

const LEFT = { x: 50, y: 150, w: 440, h: 480 };
const RIGHT = { x: 510, y: 150, w: 720, h: 480 };
const ROW_H = RIGHT.h / 5;

/** "Covil": per-dinosaur shop (Fósseis) and mastery track (passives + ability), outside of runs. */
export class LairScene extends Phaser.Scene {
  private dino: DinoId = 'trex';
  private save!: SaveData;
  private content!: Phaser.GameObjects.Container;
  private fossilsText!: Phaser.GameObjects.Text;

  constructor() {
    super('Lair');
  }

  create(data: { dino?: DinoId }): void {
    this.save = loadSave();
    this.dino = data.dino ?? this.save.lastDino ?? 'trex';
    this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'ground').setOrigin(0).setAlpha(0.5);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0c08, 0.6).setOrigin(0);

    this.add.text(GAME_WIDTH / 2, 44, 'COVIL', {
      fontFamily: FONT_BOLD, fontSize: '40px', color: COLORS.accentText, stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5);
    this.fossilsText = text(this, GAME_WIDTH - 50, 30, '', 22, COLORS.accentText, true).setOrigin(1, 0);

    this.content = this.add.container(0, 0);
    button(this, 150, GAME_HEIGHT - 45, 'VOLTAR', () => this.scene.start('Menu'), { width: 200, height: 50, fontSize: 18, color: 0x7a8a6a });
    button(this, GAME_WIDTH - 180, GAME_HEIGHT - 45, 'JOGAR COM ESTE', () => this.scene.start('CharacterSelect', { dino: this.dino }), { width: 260, height: 50, fontSize: 18 });

    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => this.move(-1));
    kb.on('keydown-A', () => this.move(-1));
    kb.on('keydown-RIGHT', () => this.move(1));
    kb.on('keydown-D', () => this.move(1));
    kb.once('keydown-ESC', () => this.scene.start('Menu'));
    if (DEBUG) {
      text(this, GAME_WIDTH / 2, GAME_HEIGHT - 20, 'DEBUG · F: +500 fósseis e +500 XP de maestria', 12, COLORS.muted).setOrigin(0.5);
      kb.on('keydown-F', () => {
        this.save = debugGrant(500, 500);
        this.render();
      });
    }

    this.render();
    this.cameras.main.fadeIn(250);
  }

  private move(dir: number): void {
    const i = DINO_ORDER.indexOf(this.dino);
    this.dino = DINO_ORDER[(i + dir + DINO_ORDER.length) % DINO_ORDER.length];
    this.render();
  }

  private render(): void {
    this.content.removeAll(true);
    this.fossilsText.setText(`FÓSSEIS: ${this.save.fossils}`);
    this.drawTabs();
    this.drawMastery();
    this.drawShop();
  }

  private drawTabs(): void {
    DINO_ORDER.forEach((id, i) => {
      const d = DINOSAURS[id];
      const sel = id === this.dino;
      const x = GAME_WIDTH / 2 + (i - 1) * 230;
      const b = button(this, x, 102, d.name, () => {
        this.dino = id;
        this.render();
      }, { width: 210, height: 44, fontSize: 17, color: sel ? COLORS.accent : 0x4a5638 });
      this.content.add(b);
    });
  }

  private panel(r: { x: number; y: number; w: number; h: number }, accent: number): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.95);
    g.fillRoundedRect(r.x, r.y, r.w, r.h, 12);
    g.lineStyle(2, accent, 1);
    g.strokeRoundedRect(r.x, r.y, r.w, r.h, 12);
    this.content.add(g);
  }

  private drawMastery(): void {
    const d = DINOSAURS[this.dino];
    const prog = masteryProgress(this.save.mastery[this.dino] ?? 0);
    this.panel(LEFT, COLORS.border);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.content.add(o);
      return o;
    };

    add(this.add.image(LEFT.x + 60, LEFT.y + 55, d.texture).setScale(1.2).setRotation(-Math.PI / 2));
    add(text(this, LEFT.x + 115, LEFT.y + 22, d.name, 24, '#ffffff', true));
    add(text(this, LEFT.x + 115, LEFT.y + 56, `MAESTRIA ${prog.level}`, 18, hex(d.accentColor), true));

    const barX = LEFT.x + 115;
    const barW = LEFT.w - 140;
    const bar = add(this.add.graphics());
    bar.fillStyle(0x30382a, 1);
    bar.fillRoundedRect(barX, LEFT.y + 84, barW, 12, 4);
    bar.fillStyle(d.accentColor, 1);
    bar.fillRoundedRect(barX, LEFT.y + 84, Math.max(4, barW * (prog.needed > 0 ? prog.into / prog.needed : 1)), 12, 4);
    add(text(this, barX, LEFT.y + 100, prog.needed > 0 ? `${prog.into} / ${prog.needed} XP` : 'NÍVEL MÁXIMO', 13, COLORS.muted));

    add(text(this, LEFT.x + 20, LEFT.y + 126, 'EVOLUÇÃO', 18, COLORS.accentText, true));
    add(text(this, LEFT.x + 20, LEFT.y + 148, 'A maestria libera e melhora as passivas e a habilidade.', 13, COLORS.muted));
    const rows = PASSIVES[this.dino].map((p, slot) => {
      const rank = passiveRank(slot, prog.level);
      const next = rank < 2 ? masteryFor('passive', rank + 1, slot) : 0;
      return { name: p.name, description: p.description, extra: p.rank2, rank, max: 2, next };
    });
    const abRank = abilityMasteryRank(prog.level);
    rows.push({
      name: d.abilityName, description: ABILITY_MASTERY[this.dino].description, extra: 'Sempre disponível; a maestria só a fortalece.',
      rank: abRank, max: ABILITY_MAX_RANK, next: abRank < ABILITY_MAX_RANK ? masteryFor('ability', abRank + 1) : 0,
    });
    rows.forEach((r, i) => {
      const y = LEFT.y + 172 + i * 76;
      const on = r.rank > 0;
      const box = add(this.add.graphics());
      box.fillStyle(on ? COLORS.panelLight : 0x141810, 1);
      box.fillRoundedRect(LEFT.x + 16, y, LEFT.w - 32, 72, 8);
      if (on) {
        box.lineStyle(2, d.accentColor, 0.8);
        box.strokeRoundedRect(LEFT.x + 16, y, LEFT.w - 32, 72, 8);
      }
      add(text(this, LEFT.x + 28, y + 6, r.name, 15, on ? '#ffffff' : '#6a6a5a', true));
      const status = on ? `NÍVEL ${roman(r.rank)}` : `MAESTRIA ${r.next}`;
      const hint = r.next ? (on ? `  ·  ${roman(r.rank + 1)} na M${r.next}` : '') : '  ·  MÁX.';
      add(text(this, LEFT.x + LEFT.w - 28, y + 8, status + hint, 12, on ? '#6aff8a' : COLORS.muted, true).setOrigin(1, 0));
      add(this.add.text(LEFT.x + 28, y + 24, r.description, {
        fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif', fontSize: '12px', color: on ? '#d8d0b8' : '#6a6a5a',
        wordWrap: { width: LEFT.w - 56 },
      }));
      const extraOn = i < 3 ? r.rank >= 2 : true;
      add(text(this, LEFT.x + 28, y + 55, r.extra, 11, extraOn && on ? hex(d.accentColor) : '#5a5a4a', true));
    });
  }

  private drawShop(): void {
    this.panel(RIGHT, COLORS.border);
    SHOP[this.dino].forEach((item, i) => this.drawItem(item, RIGHT.y + i * ROW_H));
  }

  private drawItem(item: ShopItemDef, y: number): void {
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.content.add(o);
      return o;
    };
    const lvl = shopLevel(this.save, this.dino, item.id);
    const max = item.costs.length;
    const status = purchaseStatus(this.save, this.dino, item);
    const accent = DINOSAURS[this.dino].accentColor;

    if (y > RIGHT.y) {
      const sep = add(this.add.graphics());
      sep.lineStyle(1, COLORS.border, 0.6);
      sep.lineBetween(RIGHT.x + 16, y, RIGHT.x + RIGHT.w - 16, y);
    }
    add(text(this, RIGHT.x + 24, y + 16, item.name, 19, '#ffffff', true));
    add(text(this, RIGHT.x + 24, y + 46, item.description, 14, '#d8d0b8'));

    const pips = add(this.add.graphics());
    for (let p = 0; p < max; p++) {
      pips.fillStyle(p < lvl ? accent : 0x30382a, 1);
      pips.fillRoundedRect(RIGHT.x + 330 + p * 34, y + 20, 28, 14, 3);
    }
    add(text(this, RIGHT.x + 330, y + 44, `NÍVEL ${lvl}/${max}`, 13, COLORS.muted, true));

    const bx = RIGHT.x + RIGHT.w - 120;
    const by = y + ROW_H / 2;
    if (status === 'maxed') {
      add(text(this, bx, by, 'MÁXIMO', 18, '#6aff8a', true).setOrigin(0.5));
      return;
    }
    const cost = item.costs[lvl];
    const b = button(this, bx, by, `${cost} FÓSSEIS`, () => this.buy(item, bx, by), {
      width: 190, height: 46, fontSize: 16, color: status === 'ok' ? COLORS.accent : 0x5a5a4a,
    });
    add(b);
  }

  private buy(item: ShopItemDef, x: number, y: number): void {
    const updated = purchase(this.dino, item);
    if (!updated) {
      const t = text(this, x, y - 34, 'Fósseis insuficientes', 14, '#ff6a5a', true).setOrigin(0.5);
      this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 900, onComplete: () => t.destroy() });
      return;
    }
    this.save = updated;
    this.render();
    const t = text(this, x, y - 30, `${item.name} ${shopLevel(updated, this.dino, item.id)}!`, 16, '#6aff8a', true).setOrigin(0.5);
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 1000, onComplete: () => t.destroy() });
    this.cameras.main.flash(120, 255, 210, 120);
  }
}
