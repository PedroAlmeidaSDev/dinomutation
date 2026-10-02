import Phaser from 'phaser';
import { ARENA_OBSTACLES, type ObstacleType } from '../../data/arena';
import { BALANCE } from '../../data/balance';
import type { StatKey } from '../components/StatsComponent';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { Run } from '../core/Run';
import type { PickupKind } from '../systems/PickupSystem';
import { designOffset, fitShade, safeInsets } from './layout';
import { formatStat, statLabel } from './statFormat';
import { COLORS, RARITY_COLORS, button, drawPanel, fullscreenButton, hex, text, title } from './theme';

const PANEL_Y = 110;
const PANEL_H = 480;
const MAP_SIZE = 320;

const OBSTACLE_COLORS: Record<ObstacleType, number> = {
  rock: 0x7a7a68, bigRock: 0x7a7a68, tree: 0x3f7a35, bones: 0xd8d0b8, skull: 0xd8d0b8,
};
const PICKUP_COLORS: Record<Exclude<PickupKind, 'dna'>, number> = {
  meat: 0xff6a5a, magnet: 0x4aa8ff, mutagen: 0xc070ff,
};

/** ESC menu: current build, stats and a minimap of the arena. */
export class PauseMenu {
  private readonly root: Phaser.GameObjects.Container;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly fs: Phaser.GameObjects.Container | null;

  constructor(private readonly scene: Phaser.Scene, run: Run, onResume: () => void, onQuit: () => void) {
    const objs: Phaser.GameObjects.GameObject[] = [];
    this.shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.85).setOrigin(0).setInteractive();
    objs.push(this.shade);
    objs.push(title(scene, GAME_WIDTH / 2, 58, 'PAUSADO', 44).setOrigin(0.5));

    const panels: [number, number][] = [[30, 340], [390, 480], [890, 360]];
    const panel = scene.add.graphics();
    for (const [x, w] of panels) {
      drawPanel(panel, x, PANEL_Y, w, PANEL_H, { cut: 14 });
      panel.fillStyle(COLORS.border, 1);
      panel.fillRect(x + 16, PANEL_Y + 42, w - 32, 1);
    }
    objs.push(panel);

    // Stats
    objs.push(text(scene, 48, 124, `${run.player.def.name} — ATRIBUTOS`, 18, COLORS.accentText, true));
    const s = run.player.stats;
    const rows: StatKey[] = [
      'maxHealth', 'damage', 'attackSpeed', 'moveSpeed', 'armor', 'critChance',
      'critDamage', 'attackRange', 'size', 'regen', 'cooldownReduction', 'repeatChance',
    ];
    rows.forEach((k, i) => {
      objs.push(text(scene, 52, 164 + i * 32, statLabel(k), 16, COLORS.muted));
      objs.push(text(scene, 350, 164 + i * 32, formatStat(k, s.get(k)), 16, COLORS.text, true).setOrigin(1, 0));
    });

    // Mutations
    const primary = run.upgrades.primaryTag;
    objs.push(text(scene, 408, 124, `MUTAÇÕES${primary ? ` — BUILD ${primary.toUpperCase()}` : ''}`, 18, COLORS.accentText, true));
    const list = run.upgrades.ownedList().filter((u) => !u.def.consumable);
    if (list.length === 0) objs.push(text(scene, 408, 164, 'Nenhuma mutação ainda.', 16, COLORS.muted));
    list.forEach((u, i) => {
      const col = i < 14 ? 0 : 1;
      const row = i % 14;
      objs.push(text(scene, 410 + col * 235, 162 + row * 29, `${u.def.name}${u.level > 1 ? ` ${u.level}` : ''}`, 14, hex(RARITY_COLORS[u.def.rarity]), true));
    });

    // Minimap
    objs.push(text(scene, 908, 124, 'MAPA', 18, COLORS.accentText, true));
    objs.push(...this.minimap(run, 910, 160));

    objs.push(button(scene, GAME_WIDTH / 2 - 150, GAME_HEIGHT - 70, 'CONTINUAR', onResume, { width: 260 }));
    objs.push(button(scene, GAME_WIDTH / 2 + 150, GAME_HEIGHT - 70, 'MENU', onQuit, { width: 260, ghost: true }));
    this.fs = fullscreenButton(scene, 0, 0);
    if (this.fs) objs.push(this.fs);
    this.root = scene.add.container(0, 0, objs).setDepth(1100);
    this.layout();
  }

  /** Centres the panels in the current screen; the ⛶ button stays in the top-right corner. */
  layout(): void {
    const o = designOffset(this.scene);
    this.root.setPosition(o.x, o.y);
    fitShade(this.shade, this.scene);
    this.fs?.setPosition(this.scene.scale.width - o.x - safeInsets(this.scene).right - 52, 56 - o.y);
  }

  /** Snapshot of the arena (the run is frozen while paused, so it never needs redrawing). */
  private minimap(run: Run, x: number, y: number): Phaser.GameObjects.GameObject[] {
    const scene = this.scene;
    const W = BALANCE.world.width;
    const H = BALANCE.world.height;
    const k = MAP_SIZE / Math.max(W, H);
    const mx = (wx: number) => x + wx * k;
    const my = (wy: number) => y + wy * k;
    const g = scene.add.graphics();

    // Ground and border cliffs
    const T = BALANCE.world.wallThickness * k;
    g.fillStyle(COLORS.bg, 1);
    g.fillRect(x, y, W * k, H * k);
    g.fillStyle(COLORS.panelLight, 1);
    g.fillRect(x + T, y + T, W * k - 2 * T, H * k - 2 * T);

    for (const o of ARENA_OBSTACLES) {
      g.fillStyle(OBSTACLE_COLORS[o.type], 0.9);
      g.fillCircle(mx(o.x), my(o.y), Math.max(2, o.r * k));
    }

    // DNA as faint specks, special drops as bright dots
    for (const p of run.pickups.active) {
      if (p.dead) continue;
      if (p.kind === 'dna') {
        g.fillStyle(COLORS.xp, 0.55);
        g.fillRect(mx(p.x) - 1, my(p.y) - 1, 2, 2);
      } else {
        g.fillStyle(0x000000, 0.8);
        g.fillCircle(mx(p.x), my(p.y), 4.5);
        g.fillStyle(PICKUP_COLORS[p.kind], 1);
        g.fillCircle(mx(p.x), my(p.y), 3);
      }
    }

    // Visible area
    const view = run.scene.cameras.main.worldView;
    g.lineStyle(1.5, 0xffffff, 0.45);
    g.strokeRect(mx(view.x), my(view.y), view.width * k, view.height * k);

    // Enemies: normals first so elites and bosses are drawn on top
    for (const e of run.enemies) {
      if (e.dead || e.def.rank !== 'normal') continue;
      g.fillStyle(0xe04a3a, 0.9);
      g.fillCircle(mx(e.x), my(e.y), 2);
    }
    for (const e of run.enemies) {
      if (e.dead || e.def.rank === 'normal') continue;
      const boss = e.def.rank === 'boss';
      g.fillStyle(0x000000, 0.8);
      g.fillCircle(mx(e.x), my(e.y), boss ? 8 : 6);
      g.fillStyle(boss ? 0xff2a1a : 0xff8a3a, 1);
      g.fillCircle(mx(e.x), my(e.y), boss ? 6 : 4);
      if (boss) {
        g.lineStyle(2, 0xffffff, 0.8);
        g.strokeCircle(mx(e.x), my(e.y), 10);
      }
    }

    // Player
    const px = mx(run.player.x);
    const py = my(run.player.y);
    g.fillStyle(0x000000, 0.9);
    g.fillCircle(px, py, 7);
    g.fillStyle(COLORS.accent, 1);
    g.fillCircle(px, py, 5);
    g.lineStyle(2, 0xffffff, 0.9);
    g.strokeCircle(px, py, 9);

    g.lineStyle(1, COLORS.border, 1);
    g.strokeRect(x, y, W * k, H * k);

    // Legend
    const legend: [number, string, number][] = [
      [COLORS.accent, 'Você', 5],
      [0xe04a3a, 'Inimigo', 3],
      [0xff8a3a, 'Elite', 4],
      [0xff2a1a, 'Chefe', 5],
      [PICKUP_COLORS.meat, 'Carne', 3],
      [PICKUP_COLORS.mutagen, 'Mutagênico', 3],
    ];
    const out: Phaser.GameObjects.GameObject[] = [g];
    legend.forEach(([color, label, r], i) => {
      const lx = x + 6 + (i % 2) * 165;
      const ly = y + MAP_SIZE + 22 + Math.floor(i / 2) * 26;
      g.fillStyle(color, 1);
      g.fillCircle(lx, ly, r);
      out.push(text(scene, lx + 14, ly, label, 14, COLORS.text).setOrigin(0, 0.5));
    });
    return out;
  }

  destroy(): void {
    this.root.destroy();
  }
}
