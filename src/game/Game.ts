import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { HUDScene } from './scenes/HUDScene';
import { MenuScene } from './scenes/MenuScene';
import { GameOverScene, VictoryScene } from './scenes/ResultScene';
import { RunScene } from './scenes/RunScene';

export function createGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#12150e',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: { antialias: true, pixelArt: false },
    fps: { target: 60 },
    scene: [BootScene, MenuScene, CharacterSelectScene, RunScene, HUDScene, GameOverScene, VictoryScene],
  });
}
