import Phaser from 'phaser';
import { TAG_COLORS, TAG_LABELS } from '../../data/upgrades';
import { DEBUG } from '../config';
import type { Run } from '../core/Run';
import type { Enemy } from '../entities/enemies/Enemy';
import { formatTime } from '../../utils/math';
import { safeInsets } from './layout';
import { COLORS, RARITY_COLORS, drawBar, drawPanel, drawTagIcon, hex, text, title } from './theme';

/** In-run heads-up display. Reads run state every frame; owns no game logic. */
export class HUD {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly iconG: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly timerText: Phaser.GameObjects.Text;
  private readonly killsText: Phaser.GameObjects.Text;
  private readonly abilityText: Phaser.GameObjects.Text;
  private readonly abilityKey: Phaser.GameObjects.Text;
  private readonly bossName: Phaser.GameObjects.Text;
  private readonly buildText: Phaser.GameObjects.Text;
  private readonly debugText?: Phaser.GameObjects.Text;
  private readonly levelTexts: Phaser.GameObjects.Text[] = [];
  private upgradeSignature = '';
  private abilityWasReady = true;
  private abilityPulse = 0;
  private touchLayout = false;
  /** Screen size and safe-area margins, refreshed by layout(). */
  private W = 0;
  private H = 0;
  private L = 0;
  private R = 0;
  private B = 0;
  /** Ability button position; moved bottom-right and enlarged in touch layout. */
  readonly ability = { x: 0, y: 0, r: 30 };

  constructor(private readonly scene: Phaser.Scene, private readonly run: Run) {
    this.g = scene.add.graphics();
    this.iconG = scene.add.graphics();
    this.hpText = text(scene, 0, 37, '', 12, COLORS.text, true).setOrigin(0.5);
    this.levelText = text(scene, 0, 72, '', 14, COLORS.acidText, true).setOrigin(0.5);
    this.timerText = text(scene, 0, 24, '00:00', 28, COLORS.text, true).setOrigin(0.5, 0);
    this.killsText = text(scene, 0, 60, '', 15, COLORS.muted, false).setOrigin(0.5, 0);
    this.abilityText = text(scene, 0, 0, run.abilities.ability.name.toUpperCase(), 12, COLORS.text, true).setOrigin(0.5);
    this.abilityKey = text(scene, 0, 0, 'SPACE', 13, '#ffffff', true).setOrigin(0.5);
    this.bossName = text(scene, 0, 94, '', 15, COLORS.text, true).setOrigin(0.5, 0).setVisible(false);
    this.buildText = text(scene, 0, 0, '', 13, COLORS.text, true);
    if (DEBUG) {
      this.debugText = text(scene, 0, 0,
        'DEBUG  1:+Nível  2:Invencível  3:Elite  4:Boss  5:Matar todos  6:+60s', 12, COLORS.acidText).setOrigin(1, 1);
    }
    this.layout();
  }

  /** Big thumb-sized ability button in the bottom-right corner. */
  useTouchLayout(): void {
    if (this.touchLayout) return;
    this.touchLayout = true;
    this.abilityText.setVisible(false);
    this.abilityKey.setText(this.run.abilities.ability.name.toUpperCase()).setFontSize(17);
    this.layout();
  }

  /** Anchors everything to the current screen edges. Called on start and on every resize. */
  layout(): void {
    const s = this.scene.scale;
    const inset = safeInsets(this.scene);
    this.W = s.width;
    this.H = s.height;
    this.L = 16 + inset.left;
    this.R = inset.right;
    this.B = inset.bottom;
    const cx = this.W / 2;
    const bottom = this.H - this.B;

    this.hpText.setX(this.L + 38 + 132);
    this.levelText.setX(this.L + 22);
    this.timerText.setX(cx);
    this.killsText.setX(cx);
    this.bossName.setX(cx);
    if (this.touchLayout) {
      Object.assign(this.ability, { x: this.W - this.R - 130, y: bottom - 140, r: 64 });
      this.abilityKey.setPosition(this.ability.x, this.ability.y);
      this.debugText?.setPosition(this.W - this.R - 12, bottom - 250);
    } else {
      Object.assign(this.ability, { x: cx, y: bottom - 70, r: 30 });
      this.abilityText.setPosition(cx, bottom - 26);
      this.abilityKey.setPosition(cx, bottom - 72);
      this.debugText?.setPosition(this.W - this.R - 12, bottom - 12);
    }
    // Force the upgrade row to redraw at the new position.
    this.upgradeSignature = '';
  }

  update(dt: number): void {
    const run = this.run;
    const p = run.player;
    const g = this.g;
    g.clear();

    // XP bar (full width)
    drawBar(g, 0, 0, this.W, 6, run.xp.progress, COLORS.xp, COLORS.xpBack);
    this.levelText.setText(`${run.xp.level}`);

    // HP: heart + flat bar; the level sits in a small badge under the heart.
    const hpRatio = Math.max(0, p.health.ratio);
    const hx = this.L + 38;
    drawBar(g, hx, 30, 264, 14, hpRatio, hpRatio < 0.3 ? 0xff1f3d : COLORS.hp, COLORS.hpBack);
    this.drawHeart(g, this.L + 20, 37, 22);
    this.hpText.setText(`${Math.ceil(Math.max(0, p.health.current))} / ${Math.round(p.health.max)}`);
    drawPanel(g, this.L + 8, 58, 28, 28, { cut: 6, stroke: COLORS.acid, strokeWidth: 1.5 });

    // Timer & kills
    drawPanel(g, this.W / 2 - 70, 18, 140, 64, { cut: 10, alpha: 0.7, stroke: null });
    this.timerText.setText(formatTime(run.director.elapsed));
    const era = run.director.endless ? `ERA ${run.run.era}  ·  ` : '';
    this.killsText.setText(`${era}☠ ${run.run.kills}`);

    // Boss / elite bar
    const big: Enemy | null = run.director.boss ?? run.director.elite;
    if (big && !big.dead) {
      const w = big.isBossLike && big.def.rank === 'boss' ? 620 : 420;
      const x = this.W / 2 - w / 2;
      drawBar(g, x, 120, w, 10, Math.max(0, big.hpRatio), big.def.rank === 'boss' ? COLORS.hp : COLORS.accent, COLORS.hpBack);
      if (big.def.rank === 'boss') {
        // Phase thresholds (Giganotosaurus: 66% / 33%).
        g.lineStyle(2, 0xfff3ea, 0.7);
        for (const t of [big.def.params.phase2At, big.def.params.phase3At]) {
          if (t) g.lineBetween(x + w * t, 117, x + w * t, 133);
        }
      }
      this.bossName.setVisible(true).setText(big.def.name.toUpperCase());
    } else {
      this.bossName.setVisible(false);
    }

    // Ability cooldown
    const ab = run.abilities;
    const { x: cx, y: cy, r } = this.ability;
    if (ab.ready && !this.abilityWasReady) this.abilityPulse = 1;
    this.abilityWasReady = ab.ready;
    this.abilityPulse = Math.max(0, this.abilityPulse - dt * 2);
    // Flat disc: fills up clockwise while on cooldown, solid lava when ready.
    g.fillStyle(COLORS.panel, 0.85);
    g.fillCircle(cx, cy, r + 4);
    g.fillStyle(ab.ready ? COLORS.accent : COLORS.panelLight, 1);
    g.fillCircle(cx, cy, r);
    if (!ab.ready) {
      g.fillStyle(COLORS.accent, 0.55);
      g.slice(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ab.readiness, false);
      g.fillPath();
    }
    if (this.abilityPulse > 0) {
      g.lineStyle(3, COLORS.accent, this.abilityPulse);
      g.strokeCircle(cx, cy, r + 6 + (1 - this.abilityPulse) * 18);
    }
    this.abilityKey.setColor(ab.ready ? '#ffffff' : COLORS.muted);
    if (!this.touchLayout) {
      drawPanel(g, cx - 80, this.H - this.B - 39, 160, 26, { cut: 6, alpha: 0.75, stroke: null });
    }

    this.drawUpgrades();
  }

  /** Small indicators for every upgrade owned. Only rebuilt when the build changes. */
  private drawUpgrades(): void {
    const list = this.run.upgrades.ownedList().filter((u) => !u.def.consumable);
    const sig = list.map((u) => `${u.def.id}${u.level}`).join(',') + this.run.upgrades.primaryTag;
    if (sig === this.upgradeSignature) return;
    this.upgradeSignature = sig;

    const g = this.iconG;
    g.clear();
    for (const t of this.levelTexts) t.destroy();
    this.levelTexts.length = 0;

    const size = 34;
    const gap = 5;
    const perRow = 12;
    const baseY = this.H - this.B - 16 - size;
    list.forEach((u, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = this.L + col * (size + gap);
      const y = baseY - row * (size + gap);
      drawPanel(g, x, y, size, size, { cut: 6, stroke: RARITY_COLORS[u.def.rarity], strokeWidth: 1.5 });
      const icon = u.def.icon ?? u.def.tags[0];
      drawTagIcon(g, icon, x + size / 2, y + size / 2, size * 0.6, TAG_COLORS[icon] ?? 0xffffff);
      if (u.level > 1) {
        this.levelTexts.push(text(this.scene, x + size - 3, y + size - 2, `${u.level}`, 12, COLORS.text, true).setOrigin(1, 1));
      }
    });
    const rows = Math.ceil(list.length / perRow);
    const primary = this.run.upgrades.primaryTag;
    this.buildText.setPosition(this.L, baseY - rows * (size + gap) + 12);
    this.buildText.setText(primary && list.length >= 2 ? `BUILD: ${TAG_LABELS[primary] ?? primary.toUpperCase()}` : '');
    this.buildText.setColor(primary ? hex(TAG_COLORS[primary] ?? 0xffffff) : COLORS.text);
  }

  private drawHeart(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
    const r = s * 0.28;
    g.fillStyle(COLORS.hp, 1);
    g.fillCircle(x - r * 0.95, y - s * 0.12, r);
    g.fillCircle(x + r * 0.95, y - s * 0.12, r);
    g.fillTriangle(x - r * 1.95, y - s * 0.04, x + r * 1.95, y - s * 0.04, x, y + s * 0.5);
  }

  /** Big announcement across the top of the screen. */
  banner(heading: string, sub?: string, color = COLORS.accent): void {
    const s = this.scene;
    const t = title(s, this.W / 2, 190, heading, 40, color).setOrigin(0.5).setAlpha(0).setScale(1.4);
    const st = sub ? text(s, this.W / 2, 234, sub, 17, COLORS.text, true).setOrigin(0.5).setAlpha(0) : null;
    s.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' });
    if (st) s.tweens.add({ targets: st, alpha: 1, duration: 300, delay: 120 });
    s.time.delayedCall(2600, () => {
      s.tweens.add({ targets: st ? [t, st] : [t], alpha: 0, y: '-=20', duration: 400, onComplete: () => { t.destroy(); st?.destroy(); } });
    });
  }
}
