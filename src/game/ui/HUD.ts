import Phaser from 'phaser';
import { TAG_COLORS, TAG_LABELS } from '../../data/upgrades';
import { DEBUG, GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { Run } from '../core/Run';
import type { Enemy } from '../entities/enemies/Enemy';
import { formatTime } from '../../utils/math';
import { COLORS, FONT_BOLD, RARITY_COLORS, drawTagIcon, hex, text } from './theme';

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
  /** Ability button position; moved bottom-right and enlarged in touch layout. */
  readonly ability = { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 70, r: 30 };

  constructor(private readonly scene: Phaser.Scene, private readonly run: Run) {
    this.g = scene.add.graphics();
    this.iconG = scene.add.graphics();
    this.hpText = text(scene, 160, 34, '', 15, '#ffffff', true).setOrigin(0.5);
    this.levelText = text(scene, 16, 52, '', 18, COLORS.accentText, true);
    this.timerText = text(scene, GAME_WIDTH / 2, 22, '00:00', 30, '#ffffff', true).setOrigin(0.5, 0);
    this.killsText = text(scene, GAME_WIDTH / 2, 60, '', 15, COLORS.muted, false).setOrigin(0.5, 0);
    this.abilityText = text(scene, GAME_WIDTH / 2, GAME_HEIGHT - 26, run.abilities.ability.name.toUpperCase(), 13, '#ffffff', true).setOrigin(0.5);
    this.abilityKey = text(scene, GAME_WIDTH / 2, GAME_HEIGHT - 72, 'SPACE', 14, '#ffffff', true).setOrigin(0.5);
    this.bossName = text(scene, GAME_WIDTH / 2, 92, '', 16, '#ffd0c0', true).setOrigin(0.5, 0).setVisible(false);
    this.buildText = text(scene, 16, GAME_HEIGHT - 130, '', 14, '#ffffff', true);
    if (DEBUG) {
      this.debugText = text(scene, GAME_WIDTH - 12, GAME_HEIGHT - 12,
        'DEBUG  1:+Nível  2:Invencível  3:Elite  4:Boss  5:Matar todos  6:+60s', 12, '#8aff8a').setOrigin(1, 1);
    }
  }

  /** Big thumb-sized ability button in the bottom-right corner. */
  useTouchLayout(): void {
    if (this.touchLayout) return;
    this.touchLayout = true;
    Object.assign(this.ability, { x: GAME_WIDTH - 130, y: GAME_HEIGHT - 140, r: 64 });
    this.abilityText.setVisible(false);
    this.abilityKey.setText(this.run.abilities.ability.name.toUpperCase()).setFontSize(17)
      .setPosition(this.ability.x, this.ability.y);
    this.debugText?.setY(GAME_HEIGHT - 250);
  }

  update(dt: number): void {
    const run = this.run;
    const p = run.player;
    const g = this.g;
    g.clear();

    // XP bar (full width)
    g.fillStyle(COLORS.xpBack, 0.9);
    g.fillRect(0, 0, GAME_WIDTH, 10);
    g.fillStyle(COLORS.xp, 1);
    g.fillRect(0, 0, GAME_WIDTH * Math.min(1, run.xp.progress), 10);
    this.levelText.setText(`NÍVEL ${run.xp.level}`);

    // HP
    const hpRatio = Math.max(0, p.health.ratio);
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(14, 20, 292, 28, 6);
    g.fillStyle(COLORS.hpBack, 1);
    g.fillRoundedRect(18, 24, 284, 20, 4);
    g.fillStyle(hpRatio < 0.3 ? 0xff2020 : COLORS.hp, 1);
    if (hpRatio > 0) g.fillRoundedRect(18, 24, Math.max(8, 284 * hpRatio), 20, 4);
    this.hpText.setText(`${Math.ceil(Math.max(0, p.health.current))} / ${Math.round(p.health.max)}`);

    // Timer & kills
    this.timerText.setText(formatTime(run.director.elapsed));
    this.killsText.setText(`☠ ${run.run.kills}`);

    // Boss / elite bar
    const big: Enemy | null = run.director.boss ?? run.director.elite;
    if (big && !big.dead) {
      const w = big.isBossLike && big.def.rank === 'boss' ? 620 : 420;
      const x = GAME_WIDTH / 2 - w / 2;
      g.fillStyle(0x000000, 0.6);
      g.fillRoundedRect(x - 4, 114, w + 8, 22, 5);
      g.fillStyle(0x3a0c08, 1);
      g.fillRect(x, 118, w, 14);
      g.fillStyle(big.def.rank === 'boss' ? 0xe02a1a : 0xff7040, 1);
      g.fillRect(x, 118, w * Math.max(0, big.hpRatio), 14);
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
    g.fillStyle(0x000000, 0.6);
    g.fillCircle(cx, cy, r + 5);
    g.fillStyle(ab.ready ? COLORS.accent : 0x444a3a, 1);
    g.fillCircle(cx, cy, r);
    if (!ab.ready) {
      g.fillStyle(COLORS.accent, 0.8);
      g.slice(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ab.readiness, false);
      g.fillPath();
    }
    if (this.abilityPulse > 0) {
      g.lineStyle(4, 0xffffff, this.abilityPulse);
      g.strokeCircle(cx, cy, r + 6 + (1 - this.abilityPulse) * 18);
    }
    this.abilityKey.setColor(ab.ready ? '#1a1408' : '#ffffff').setStroke(ab.ready ? '#ffe0a0' : '#000000', 3);
    if (!this.touchLayout) {
      g.fillStyle(0x000000, 0.55);
      g.fillRoundedRect(cx - 90, GAME_HEIGHT - 36, 180, 20, 6);
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
    const baseY = GAME_HEIGHT - 16 - size;
    list.forEach((u, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = 16 + col * (size + gap);
      const y = baseY - row * (size + gap);
      g.fillStyle(0x000000, 0.6);
      g.fillRoundedRect(x, y, size, size, 5);
      g.lineStyle(2, RARITY_COLORS[u.def.rarity], 1);
      g.strokeRoundedRect(x, y, size, size, 5);
      const icon = u.def.icon ?? u.def.tags[0];
      drawTagIcon(g, icon, x + size / 2, y + size / 2, size * 0.6, TAG_COLORS[icon] ?? 0xffffff);
      if (u.level > 1) {
        this.levelTexts.push(text(this.scene, x + size - 3, y + size - 2, `${u.level}`, 12, '#ffffff', true).setOrigin(1, 1));
      }
    });
    const rows = Math.ceil(list.length / perRow);
    const primary = this.run.upgrades.primaryTag;
    this.buildText.setY(baseY - rows * (size + gap) + 12);
    this.buildText.setText(primary && list.length >= 2 ? `BUILD: ${TAG_LABELS[primary] ?? primary.toUpperCase()}` : '');
    this.buildText.setColor(primary ? hex(TAG_COLORS[primary] ?? 0xffffff) : '#ffffff');
  }

  /** Big announcement across the top of the screen. */
  banner(title: string, sub?: string, color = 0xffc070): void {
    const s = this.scene;
    const t = s.add.text(GAME_WIDTH / 2, 190, title, {
      fontFamily: FONT_BOLD, fontSize: '40px', color: hex(color), stroke: '#000000', strokeThickness: 7,
    }).setOrigin(0.5).setAlpha(0).setScale(1.4);
    const st = sub ? text(s, GAME_WIDTH / 2, 234, sub, 18, '#ffffff', true).setOrigin(0.5).setAlpha(0) : null;
    s.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' });
    if (st) s.tweens.add({ targets: st, alpha: 1, duration: 300, delay: 120 });
    s.time.delayedCall(2600, () => {
      s.tweens.add({ targets: st ? [t, st] : [t], alpha: 0, y: '-=20', duration: 400, onComplete: () => { t.destroy(); st?.destroy(); } });
    });
  }
}
