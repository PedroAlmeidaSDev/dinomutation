import Phaser from 'phaser';
import type { PatchNote } from '../../data/patchNotes';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { fitShade, onLayout } from './layout';
import { COLORS, FONT, button, text } from './theme';

const PANEL_W = 820;
const PANEL_TOP = 60;
const PANEL_BOTTOM = GAME_HEIGHT - 40;
const VIEW_TOP = PANEL_TOP + 104;
const VIEW_BOTTOM = PANEL_BOTTOM - 104;
const TEXT_W = PANEL_W - 110;

/**
 * "What's new" overlay for a menu-style scene (camera centred with centerDesign).
 * Scrolls with the mouse wheel, drag or arrow keys. ENTER / ESC / SPACE closes.
 */
export class PatchNotes {
  private readonly root: Phaser.GameObjects.Container;
  private readonly content: Phaser.GameObjects.Container;
  private readonly maskShape: Phaser.GameObjects.Graphics;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly maxScroll: number;
  private scroll = 0;
  private dragY: number | null = null;
  private closed = false;
  private readonly readyAt: number;

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Escape' || e.code === 'Space') this.close();
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') this.scrollBy(60);
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') this.scrollBy(-60);
  };
  private readonly onWheel = (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scrollBy(dy * 0.6);
  private readonly onDown = (p: Phaser.Input.Pointer) => { this.dragY = p.y; };
  private readonly onMove = (p: Phaser.Input.Pointer) => {
    if (this.dragY === null || !p.isDown) return;
    this.scrollBy(this.dragY - p.y);
    this.dragY = p.y;
  };
  private readonly onUp = () => { this.dragY = null; };

  constructor(private readonly scene: Phaser.Scene, note: PatchNote, private readonly onClose: () => void) {
    this.readyAt = scene.time.now + 400;
    const cx = GAME_WIDTH / 2;
    const left = cx - PANEL_W / 2;

    const shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070a, 0.8).setOrigin(0).setInteractive();
    const panel = scene.add.graphics();
    panel.fillStyle(COLORS.panel, 0.97);
    panel.fillRoundedRect(left, PANEL_TOP, PANEL_W, PANEL_BOTTOM - PANEL_TOP, 16);
    panel.lineStyle(3, COLORS.accent, 0.9);
    panel.strokeRoundedRect(left, PANEL_TOP, PANEL_W, PANEL_BOTTOM - PANEL_TOP, 16);
    panel.lineStyle(1, COLORS.border, 1);
    panel.lineBetween(left + 30, VIEW_TOP - 10, left + PANEL_W - 30, VIEW_TOP - 10);
    panel.lineBetween(left + 30, VIEW_BOTTOM + 10, left + PANEL_W - 30, VIEW_BOTTOM + 10);

    const heading = text(scene, cx, PANEL_TOP + 22, 'NOVIDADES', 34, COLORS.accentText, true).setOrigin(0.5, 0);
    const sub = text(scene, cx, PANEL_TOP + 66, `Versão ${note.version} · ${note.title} · ${note.date}`, 17, COLORS.muted).setOrigin(0.5, 0);

    // Scrollable body.
    this.content = scene.add.container(0, VIEW_TOP);
    let y = 0;
    for (const section of note.sections) {
      this.content.add(text(scene, left + 50, y, section.title, 20, section.color, true));
      y += 34;
      for (const item of section.items) {
        const bullet = text(scene, left + 56, y, '•', 17, section.color);
        const line = scene.add.text(left + 76, y, item, {
          fontFamily: FONT, fontSize: '17px', color: COLORS.text, lineSpacing: 4,
          wordWrap: { width: TEXT_W - 26, useAdvancedWrap: true },
        });
        this.content.add([bullet, line]);
        y += line.height + 8;
      }
      y += 14;
    }
    this.maxScroll = Math.max(0, y - 14 - (VIEW_BOTTOM - VIEW_TOP));

    this.maskShape = scene.make.graphics({}, false);
    this.maskShape.fillStyle(0xffffff);
    this.maskShape.fillRect(left, VIEW_TOP, PANEL_W, VIEW_BOTTOM - VIEW_TOP);
    this.content.setMask(this.maskShape.createGeometryMask());

    this.bar = scene.add.graphics();
    const hint = this.hint = text(scene, cx, VIEW_BOTTOM + 14, this.maxScroll > 0 ? '▼ role para ver tudo ▼' : '', 13, COLORS.muted).setOrigin(0.5, 0);
    const ok = button(scene, cx, PANEL_BOTTOM - 36, 'ENTENDI!', () => this.close(), { width: 260, height: 50, fontSize: 20 });

    this.root = scene.add.container(0, 0, [shade, panel, heading, sub, this.content, this.bar, hint, ok]).setDepth(2000).setAlpha(0);
    scene.tweens.add({ targets: this.root, alpha: 1, duration: 220 });
    onLayout(scene, () => { if (!this.closed) fitShade(shade, scene); });
    this.drawBar();

    scene.input.keyboard?.on('keydown', this.onKey);
    scene.input.on('wheel', this.onWheel);
    scene.input.on('pointerdown', this.onDown);
    scene.input.on('pointermove', this.onMove);
    scene.input.on('pointerup', this.onUp);
  }

  get isOpen(): boolean {
    return !this.closed;
  }

  private scrollBy(dy: number): void {
    if (this.closed || this.maxScroll <= 0) return;
    this.scroll = Phaser.Math.Clamp(this.scroll + dy, 0, this.maxScroll);
    this.content.y = VIEW_TOP - this.scroll;
    this.drawBar();
    this.hint.setVisible(this.scroll < this.maxScroll - 4);
  }

  private drawBar(): void {
    this.bar.clear();
    if (this.maxScroll <= 0) return;
    const x = GAME_WIDTH / 2 + PANEL_W / 2 - 22;
    const h = VIEW_BOTTOM - VIEW_TOP;
    const thumb = Math.max(40, (h * h) / (h + this.maxScroll));
    const ty = VIEW_TOP + (h - thumb) * (this.scroll / this.maxScroll);
    this.bar.fillStyle(0x000000, 0.35);
    this.bar.fillRoundedRect(x, VIEW_TOP, 6, h, 3);
    this.bar.fillStyle(COLORS.accent, 0.9);
    this.bar.fillRoundedRect(x, ty, 6, thumb, 3);
  }

  close(): void {
    if (this.closed || this.scene.time.now < this.readyAt) return;
    this.closed = true;
    this.scene.input.keyboard?.off('keydown', this.onKey);
    this.scene.input.off('wheel', this.onWheel);
    this.scene.input.off('pointerdown', this.onDown);
    this.scene.input.off('pointermove', this.onMove);
    this.scene.input.off('pointerup', this.onUp);
    this.content.clearMask(true);
    this.maskShape.destroy();
    this.root.destroy();
    this.onClose();
  }
}
