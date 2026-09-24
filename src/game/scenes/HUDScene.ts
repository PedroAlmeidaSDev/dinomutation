import Phaser from 'phaser';
import { HUD } from '../ui/HUD';
import { PauseMenu } from '../ui/PauseMenu';
import { UpgradeSelection, type SelectionOptions } from '../ui/UpgradeSelection';
import type { RunScene } from './RunScene';

/**
 * UI overlay scene running on top of RunScene. Separate camera, so screen shake
 * and zoom never move the interface.
 */
export class HUDScene extends Phaser.Scene {
  hud!: HUD;
  private selection: UpgradeSelection | null = null;
  private pause: PauseMenu | null = null;

  constructor() {
    super('HUD');
  }

  create(data: { runScene: RunScene }): void {
    this.selection = null;
    this.pause = null;
    this.hud = new HUD(this, data.runScene.run);
    data.runScene.attachHud(this);
  }

  update(_t: number, delta: number): void {
    this.hud.update(delta / 1000);
  }

  showSelection(opts: SelectionOptions): void {
    this.selection?.close();
    this.selection = new UpgradeSelection(this, {
      ...opts,
      onPick: (c) => { this.selection = null; opts.onPick(c); },
      onReroll: () => { this.selection = null; opts.onReroll(); },
    });
  }

  showPause(onResume: () => void, onQuit: () => void): void {
    this.pause?.destroy();
    this.pause = new PauseMenu(this, (this.scene.get('Run') as RunScene).run, onResume, onQuit);
  }

  hidePause(): void {
    this.pause?.destroy();
    this.pause = null;
  }
}
