import Phaser from 'phaser';
import { HUD } from '../ui/HUD';
import { onLayout } from '../ui/layout';
import { PauseMenu } from '../ui/PauseMenu';
import { TouchControls } from '../ui/TouchControls';
import { UpgradeSelection, type SelectionOptions } from '../ui/UpgradeSelection';
import { VictoryChoice } from '../ui/VictoryChoice';
import type { RunScene } from './RunScene';

/**
 * UI overlay scene running on top of RunScene. Separate camera, so screen shake
 * and zoom never move the interface.
 */
export class HUDScene extends Phaser.Scene {
  hud!: HUD;
  touch!: TouchControls;
  private selection: UpgradeSelection | null = null;
  private pause: PauseMenu | null = null;
  private victory: VictoryChoice | null = null;

  constructor() {
    super('HUD');
  }

  create(data: { runScene: RunScene }): void {
    this.selection = null;
    this.pause = null;
    this.victory = null;
    const runScene = data.runScene;
    this.hud = new HUD(this, runScene.run);
    this.touch = new TouchControls(this, {
      abilityZone: () => this.hud.ability,
      isBlocked: () => runScene.inputBlocked,
      onAbility: () => runScene.useAbility(),
      onPause: () => runScene.togglePause(),
      onShow: () => this.hud.useTouchLayout(),
    });
    runScene.attachHud(this);
    onLayout(this, () => {
      this.hud.layout();
      this.selection?.layout();
      this.pause?.layout();
      this.victory?.layout();
    });
  }

  update(_t: number, delta: number): void {
    this.hud.update(delta / 1000);
    this.touch.update();
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

  showVictoryChoice(onContinue: () => void, onEnd: () => void): void {
    this.victory = new VictoryChoice(this,
      () => { this.victory = null; onContinue(); },
      () => { this.victory = null; onEnd(); });
  }
}
