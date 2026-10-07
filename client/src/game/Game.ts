import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { HUDScene } from './scenes/HUDScene';
import { LairScene } from './scenes/LairScene';
import { MenuScene } from './scenes/MenuScene';
import { GameOverScene, VictoryScene } from './scenes/ResultScene';
import { RunScene } from './scenes/RunScene';

export function createGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#0f0a09',
    // EXPAND fills the whole screen (no letterbox bars): the 1280×720 base is
    // always visible and the game area grows on wider/taller screens.
    scale: {
      mode: Phaser.Scale.EXPAND,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // Joystick + ability button held at the same time on touch screens.
    input: { activePointers: 3 },
    render: { antialias: true, pixelArt: false },
    fps: { target: 60 },
    scene: [BootScene, MenuScene, LairScene, CharacterSelectScene, RunScene, HUDScene, GameOverScene, VictoryScene],
  });
}
