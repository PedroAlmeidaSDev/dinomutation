import Phaser from 'phaser';
import { STAT_LABELS, type StatKey } from '../components/StatsComponent';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { Run } from '../core/Run';
import { COLORS, FONT_BOLD, RARITY_COLORS, button, hex, text } from './theme';

/** ESC menu: shows the current build and stats so the player can read their synergies. */
export class PauseMenu {
  private readonly root: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, run: Run, onResume: () => void, onQuit: () => void) {
    const objs: Phaser.GameObjects.GameObject[] = [];
    objs.push(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070a, 0.8).setOrigin(0).setInteractive());
    objs.push(scene.add.text(GAME_WIDTH / 2, 60, 'PAUSADO', {
      fontFamily: FONT_BOLD, fontSize: '46px', color: COLORS.accentText, stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5));

    const panel = scene.add.graphics();
    panel.fillStyle(COLORS.panel, 0.95);
    panel.fillRoundedRect(140, 110, 440, 480, 12);
    panel.fillRoundedRect(620, 110, 520, 480, 12);
    panel.lineStyle(2, COLORS.border, 1);
    panel.strokeRoundedRect(140, 110, 440, 480, 12);
    panel.strokeRoundedRect(620, 110, 520, 480, 12);
    objs.push(panel);

    objs.push(text(scene, 160, 124, `${run.player.def.name} — ATRIBUTOS`, 18, COLORS.accentText, true));
    const s = run.player.stats;
    const rows: [StatKey, (v: number) => string][] = [
      ['maxHealth', (v) => `${Math.round(v)}`],
      ['damage', (v) => v.toFixed(1)],
      ['attackSpeed', (v) => `${v.toFixed(2)}/s`],
      ['moveSpeed', (v) => `${Math.round(v)}`],
      ['armor', (v) => `${Math.round(v)}`],
      ['critChance', (v) => `${Math.round(v * 100)}%`],
      ['critDamage', (v) => `×${v.toFixed(2)}`],
      ['attackRange', (v) => `${Math.round(v)}`],
      ['size', (v) => `${Math.round(v * 100)}%`],
      ['regen', (v) => `${v.toFixed(1)}/s`],
      ['cooldownReduction', (v) => `${Math.round(Math.min(0.6, v) * 100)}%`],
      ['repeatChance', (v) => `${Math.round(v * 100)}%`],
    ];
    rows.forEach(([k, fmt], i) => {
      objs.push(text(scene, 170, 164 + i * 32, STAT_LABELS[k] ?? k, 16, COLORS.muted));
      objs.push(text(scene, 550, 164 + i * 32, fmt(s.get(k)), 16, '#ffffff', true).setOrigin(1, 0));
    });

    const primary = run.upgrades.primaryTag;
    objs.push(text(scene, 640, 124, `MUTAÇÕES${primary ? ` — BUILD ${primary.toUpperCase()}` : ''}`, 18, COLORS.accentText, true));
    const list = run.upgrades.ownedList().filter((u) => !u.def.consumable);
    if (list.length === 0) objs.push(text(scene, 640, 164, 'Nenhuma mutação ainda.', 16, COLORS.muted));
    list.forEach((u, i) => {
      const col = i < 14 ? 0 : 1;
      const row = i % 14;
      objs.push(text(scene, 640 + col * 250, 162 + row * 29, `${u.def.name}${u.level > 1 ? ` ${u.level}` : ''}`, 15, hex(RARITY_COLORS[u.def.rarity]), true));
    });

    objs.push(button(scene, GAME_WIDTH / 2 - 150, GAME_HEIGHT - 70, 'CONTINUAR', onResume, { width: 260 }));
    objs.push(button(scene, GAME_WIDTH / 2 + 150, GAME_HEIGHT - 70, 'MENU', onQuit, { width: 260, color: 0x9a5a4a }));
    this.root = scene.add.container(0, 0, objs).setDepth(1100);
  }

  destroy(): void {
    this.root.destroy();
  }
}
