import Phaser from 'phaser';
import { generateTextures, loadSprites } from '../art/Textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    loadSprites(this);
  }

  create(): void {
    generateTextures(this);
    this.scene.start('Menu');
  }
}
