import Phaser from 'phaser';
import { TAG_COLORS, TAG_LABELS } from '../../data/upgrades';
import { DEBUG } from '../config';
import type { Run } from '../core/Run';
import type { Enemy } from '../entities/enemies/Enemy';
import { formatTime } from '../../utils/math';
import { safeInsets } from './layout';
import { COLORS, RARITY_COLORS, drawBar, drawSlab, drawTagIcon, hex, text, title } from './theme';

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
    this.hpText = text(scene, 0, 37, '', 15, '#ffffff', true).setOrigin(0.5);
    this.levelText = text(scene, 0, 72, '', 15, '#ffffff', true).setOrigin(0.5);
    this.timerText = text(scene, 0, 22, '00:00', 30, '#ffffff', true).setOrigin(0.5, 0);
    this.killsText = text(scene, 0, 60, '', 15, COLORS.muted, false).setOrigin(0.5, 0);
    this.abilityText = text(scene, 0, 0, run.abilities.ability.name.toUpperCase(), 13, '#ffffff', true).setOrigin(0.5);
    this.abilityKey = text(scene, 0, 0, 'SPACE', 14, '#ffffff', true).setOrigin(0.5);
    this.bossName = text(scene, 0, 92, '', 16, '#ffd0c0', true).setOrigin(0.5, 0).setVisible(false);
    this.buildText = text(scene, 0, 0, '', 14, '#ffffff', true);
    if (DEBUG) {
      this.debugText = text(scene, 0, 0,
        'DEBUG  1:+Nível  2:Invencível  3:Elite  4:Boss  5:Matar todos  6:+60s', 12, '#8aff8a').setOrigin(1, 1);
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
    g.fillStyle(COLORS.outline, 1);
    g.fillRect(0, 0, this.W, 13);
    g.fillStyle(COLORS.xpBack, 1);
    g.fillRect(0, 0, this.W, 10);
    const xpW = this.W * Math.min(1, run.xp.progress);
    if (xpW > 0) {
      g.fillStyle(0x2a9a5a, 1);
      g.fillRect(0, 0, xpW, 10);
      g.fillStyle(COLORS.xp, 1);
      g.fillRect(0, 0, xpW, 7);
      g.fillStyle(0xffffff, 0.35);
      g.fillRect(0, 1, xpW, 2);
    }
    this.levelText.setText(`${run.xp.level}`);

    // HP: heart + glossy framed bar; the level sits in a round badge under the heart.
    const hpRatio = Math.max(0, p.health.ratio);
    const hx = this.L + 38;
    drawBar(g, hx, 26, 264, 22, hpRatio, hpRatio < 0.3 ? 0xff2a20 : COLORS.hp, COLORS.hpBack, 7);
    this.drawHeart(g, this.L + 20, 37, 22);
    this.hpText.setText(`${Math.ceil(Math.max(0, p.health.current))} / ${Math.round(p.health.max)}`);
    g.fillStyle(COLORS.outline, 1);
    g.fillCircle(this.L + 22, 72, 17);
    g.fillStyle(0x1e7a48, 1);
    g.fillCircle(this.L + 22, 72, 14);
    g.fillStyle(COLORS.xp, 1);
    g.fillCircle(this.L + 22, 70, 12);
    g.fillStyle(0xffffff, 0.3);
    g.fillEllipse(this.L + 22, 64, 14, 5);

    // Timer & kills on a stone plaque
    drawSlab(g, this.W / 2 - 80, 16, 160, 70, { radius: 14, border: 3, shadow: 4, alpha: 0.9 });
    this.timerText.setText(formatTime(run.director.elapsed));
    const era = run.director.endless ? `ERA ${run.run.era}  ·  ` : '';
    this.killsText.setText(`${era}☠ ${run.run.kills}`);

    // Boss / elite bar
    const big: Enemy | null = run.director.boss ?? run.director.elite;
    if (big && !big.dead) {
      const w = big.isBossLike && big.def.rank === 'boss' ? 620 : 420;
      const x = this.W / 2 - w / 2;
      drawBar(g, x, 118, w, 16, Math.max(0, big.hpRatio), big.def.rank === 'boss' ? 0xe02a1a : 0xff7040, 0x3a0c08, 5);
      if (big.def.rank === 'boss') {
        // Phase thresholds (Giganotosaurus: 66% / 33%).
        g.lineStyle(2, 0xffffff, 0.6);
        for (const t of [big.def.params.phase2At, big.def.params.phase3At]) {
          if (t) g.lineBetween(x + w * t, 116, x + w * t, 134);
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
    // Stone ring around the ability disc.
    g.fillStyle(0x000000, 0.35);
    g.fillCircle(cx + 2, cy + 5, r + 9);
    g.fillStyle(COLORS.outline, 1);
    g.fillCircle(cx, cy, r + 9);
    g.fillStyle(0x5a5242, 1);
    g.fillCircle(cx, cy, r + 6);
    g.fillStyle(COLORS.outline, 1);
    g.fillCircle(cx, cy, r + 1);
    g.fillStyle(ab.ready ? COLORS.accent : 0x3a372c, 1);
    g.fillCircle(cx, cy, r);
    if (!ab.ready) {
      g.fillStyle(COLORS.accent, 0.75);
      g.slice(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ab.readiness, false);
      g.fillPath();
    }
    g.fillStyle(0xffffff, ab.ready ? 0.3 : 0.12);
    g.fillEllipse(cx, cy - r * 0.55, r * 1.2, r * 0.45);
    if (this.abilityPulse > 0) {
      g.lineStyle(4, 0xffffff, this.abilityPulse);
      g.strokeCircle(cx, cy, r + 6 + (1 - this.abilityPulse) * 18);
    }
    this.abilityKey.setColor(ab.ready ? '#1a1408' : '#ffffff').setStroke(ab.ready ? '#ffe0a0' : '#000000', 3);
    if (!this.touchLayout) {
      drawSlab(g, cx - 92, this.H - this.B - 40, 184, 28, { radius: 10, border: 3, shadow: 3, alpha: 0.9 });
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
      drawSlab(g, x, y, size, size, { radius: 8, border: 2, shadow: 3, frame: RARITY_COLORS[u.def.rarity], frameWidth: 2, alpha: 0.92 });
      const icon = u.def.icon ?? u.def.tags[0];
      drawTagIcon(g, icon, x + size / 2, y + size / 2, size * 0.6, TAG_COLORS[icon] ?? 0xffffff);
      if (u.level > 1) {
        this.levelTexts.push(text(this.scene, x + size - 3, y + size - 2, `${u.level}`, 12, '#ffffff', true).setOrigin(1, 1));
      }
    });
    const rows = Math.ceil(list.length / perRow);
    const primary = this.run.upgrades.primaryTag;
    this.buildText.setPosition(this.L, baseY - rows * (size + gap) + 12);
    this.buildText.setText(primary && list.length >= 2 ? `BUILD: ${TAG_LABELS[primary] ?? primary.toUpperCase()}` : '');
    this.buildText.setColor(primary ? hex(TAG_COLORS[primary] ?? 0xffffff) : '#ffffff');
  }

  private drawHeart(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
    const heart = (dx: number, dy: number, k: number, color: number) => {
      const r = s * 0.28 * k;
      g.fillStyle(color, 1);
      g.fillCircle(x + dx - r * 0.95, y + dy - s * 0.12, r);
      g.fillCircle(x + dx + r * 0.95, y + dy - s * 0.12, r);
      g.fillTriangle(x + dx - r * 1.95, y + dy - s * 0.04, x + dx + r * 1.95, y + dy - s * 0.04, x + dx, y + dy + s * 0.5 * k);
    };
    heart(0, 2, 1.25, COLORS.outline);
    heart(0, 0, 1, COLORS.hp);
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(x - s * 0.3, y - s * 0.2, s * 0.09);
  }

  /** Big announcement across the top of the screen. */
  banner(heading: string, sub?: string, color = 0xffc070): void {
    const s = this.scene;
    const t = title(s, this.W / 2, 190, heading, 44, color).setOrigin(0.5).setAlpha(0).setScale(1.4);
    const st = sub ? text(s, this.W / 2, 234, sub, 18, '#ffffff', true).setOrigin(0.5).setAlpha(0) : null;
    s.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' });
    if (st) s.tweens.add({ targets: st, alpha: 1, duration: 300, delay: 120 });
    s.time.delayedCall(2600, () => {
      s.tweens.add({ targets: st ? [t, st] : [t], alpha: 0, y: '-=20', duration: 400, onComplete: () => { t.destroy(); st?.destroy(); } });
    });
  }
}
