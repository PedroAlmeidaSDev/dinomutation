import Phaser from 'phaser';
import { DINOSAURS, DINO_ORDER, type DinoId } from '../../data/dinosaurs';
import {
  ABILITY_MASTERY, ABILITY_MAX_RANK, PASSIVES, SHOP, abilityMasteryRank, masteryFor, masteryProgress, passiveRank, roman, type ShopItemDef,
} from '../../data/meta';
import { DEBUG, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { purchaseStatus, shopLevel, type SaveData } from '../core/Save';
import { debugGrant } from '../core/save/LocalSaveStore';
import { saveStore } from '../core/save/SaveStore';
import { COLORS, FONT, WEIGHT, button, drawBar, drawPanel, hex, text, title } from '../ui/theme';

const LEFT = { x: 50, y: 150, w: 440, h: 480 };
const RIGHT = { x: 510, y: 150, w: 720, h: 480 };
const ROW_H = RIGHT.h / 5;

/** "Covil": per-dinosaur shop (Fósseis) and mastery track (passives + ability), outside of runs. */
export class LairScene extends Phaser.Scene {
  private dino: DinoId = 'trex';
  private save!: SaveData;
  private content!: Phaser.GameObjects.Container;
  private fossilsText!: Phaser.GameObjects.Text;
  private buying = false;

  constructor() {
    super('Lair');
  }

  create(data: { dino?: DinoId }): void {
    this.buying = false;
    this.save = saveStore().current();
    this.dino = data.dino ?? this.save.lastDino ?? 'trex';
    this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'ground').setOrigin(0).setAlpha(0.5);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.8).setOrigin(0);

    title(this, GAME_WIDTH / 2, 44, 'COVIL', 36).setOrigin(0.5);
    this.fossilsText = text(this, GAME_WIDTH - 50, 32, '', 20, COLORS.acidText, true).setOrigin(1, 0).setLetterSpacing(2);

    this.content = this.add.container(0, 0);
    button(this, 150, GAME_HEIGHT - 45, 'VOLTAR', () => this.scene.start('Menu'), { width: 200, height: 50, fontSize: 18, ghost: true });
    button(this, GAME_WIDTH - 180, GAME_HEIGHT - 45, 'JOGAR COM ESTE', () => this.scene.start('CharacterSelect', { dino: this.dino }), { width: 260, height: 50, fontSize: 18 });

    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => this.move(-1));
    kb.on('keydown-A', () => this.move(-1));
    kb.on('keydown-RIGHT', () => this.move(1));
    kb.on('keydown-D', () => this.move(1));
    kb.once('keydown-ESC', () => this.scene.start('Menu'));
    if (DEBUG && saveStore().kind === 'local') {
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
      }, { width: 210, height: 44, fontSize: 17, ghost: !sel });
      this.content.add(b);
    });
  }

  private panel(r: { x: number; y: number; w: number; h: number }, accent: number): void {
    const g = this.add.graphics();
    drawPanel(g, r.x, r.y, r.w, r.h, { cut: 14, stroke: accent });
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

    // Sprites are long (tails): stand them upright, fitted to the header's height.
    const portrait = add(this.add.image(LEFT.x + 60, LEFT.y + 58, d.texture).setRotation(-Math.PI / 2));
    portrait.setScale(Math.min(1.2, 96 / portrait.width, 80 / portrait.height));
    add(text(this, LEFT.x + 115, LEFT.y + 22, d.name, 24, COLORS.text, true));
    add(text(this, LEFT.x + 115, LEFT.y + 56, `MAESTRIA ${prog.level}`, 18, hex(d.accentColor), true));

    const barX = LEFT.x + 115;
    const barW = LEFT.w - 140;
    const bar = add(this.add.graphics());
    drawBar(bar, barX, LEFT.y + 86, barW, 6, prog.needed > 0 ? prog.into / prog.needed : 1, d.accentColor);
    add(text(this, barX, LEFT.y + 100, prog.needed > 0 ? `${prog.into} / ${prog.needed} XP` : 'NÍVEL MÁXIMO', 13, COLORS.muted));

    add(text(this, LEFT.x + 20, LEFT.y + 126, 'EVOLUÇÃO', 16, COLORS.accentText, true).setLetterSpacing(2));
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
      drawPanel(box, LEFT.x + 16, y, LEFT.w - 32, 72, {
        cut: 8, fill: on ? COLORS.panelLight : COLORS.bg, stroke: on ? d.accentColor : null, strokeAlpha: 0.6,
      });
      add(text(this, LEFT.x + 28, y + 6, r.name, 15, on ? COLORS.text : COLORS.dim, true));
      const status = on ? `NÍVEL ${roman(r.rank)}` : `MAESTRIA ${r.next}`;
      const hint = r.next ? (on ? `  ·  ${roman(r.rank + 1)} na M${r.next}` : '') : '  ·  MÁX.';
      add(text(this, LEFT.x + LEFT.w - 28, y + 8, status + hint, 12, on ? COLORS.acidText : COLORS.muted, true).setOrigin(1, 0));
      add(this.add.text(LEFT.x + 28, y + 24, r.description, {
        fontFamily: FONT, fontStyle: WEIGHT.regular, fontSize: '12px', color: on ? COLORS.muted : COLORS.dim,
        wordWrap: { width: LEFT.w - 56 },
      }));
      const extraOn = i < 3 ? r.rank >= 2 : true;
      add(text(this, LEFT.x + 28, y + 55, r.extra, 11, extraOn && on ? hex(d.accentColor) : COLORS.dim, true));
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
    add(text(this, RIGHT.x + 24, y + 16, item.name, 19, COLORS.text, true));
    add(text(this, RIGHT.x + 24, y + 46, item.description, 14, COLORS.muted));

    const pips = add(this.add.graphics());
    for (let p = 0; p < max; p++) {
      pips.fillStyle(p < lvl ? accent : COLORS.track, 1);
      pips.fillRect(RIGHT.x + 330 + p * 34, y + 24, 28, 6);
    }
    add(text(this, RIGHT.x + 330, y + 44, `NÍVEL ${lvl}/${max}`, 13, COLORS.muted, true));

    const bx = RIGHT.x + RIGHT.w - 120;
    const by = y + ROW_H / 2;
    if (status === 'maxed') {
      add(text(this, bx, by, 'MÁXIMO', 18, COLORS.acidText, true).setOrigin(0.5));
      return;
    }
    const cost = item.costs[lvl];
    const b = button(this, bx, by, `${cost} FÓSSEIS`, () => void this.buy(item, bx, by), {
      width: 190, height: 46, fontSize: 16, ghost: status !== 'ok',
    });
    add(b);
  }

  /** One purchase at a time: with an account the shop waits for the API. */
  private async buy(item: ShopItemDef, x: number, y: number): Promise<void> {
    if (this.buying) return;
    this.buying = true;
    let updated: SaveData | null;
    try {
      updated = await saveStore().purchase(this.dino, item);
    } catch {
      this.buying = false;
      if (this.sys.isActive()) this.floatText(x, y - 34, 'Não foi possível comprar agora', COLORS.danger, 14);
      return;
    }
    this.buying = false;
    if (!this.sys.isActive()) return;
    if (!updated) {
      this.floatText(x, y - 34, 'Fósseis insuficientes', COLORS.danger, 14);
      return;
    }
    this.save = updated;
    this.render();
    this.floatText(x, y - 30, `${item.name} ${shopLevel(updated, this.dino, item.id)}!`, COLORS.acidText, 16);
    this.cameras.main.flash(120, 255, 120, 80);
  }

  private floatText(x: number, y: number, message: string, color: string, size: number): void {
    const t = text(this, x, y, message, size, color, true).setOrigin(0.5);
    this.tweens.add({ targets: t, y: y - 28, alpha: 0, duration: 950, onComplete: () => t.destroy() });
  }
}
