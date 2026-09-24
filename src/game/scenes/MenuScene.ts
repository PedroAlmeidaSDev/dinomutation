import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { loadSave } from '../core/Save';
import { formatTime } from '../../utils/math';
import { COLORS, FONT_BOLD, button, text } from '../ui/theme';
import { prefersTouch } from '../ui/TouchControls';

export class MenuScene extends Phaser.Scene {
  private walkers: { img: Phaser.GameObjects.Image; speed: number }[] = [];

  constructor() {
    super('Menu');
  }

  create(): void {
    this.walkers = [];
    this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'ground').setOrigin(0).setAlpha(0.6);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0c08, 0.45).setOrigin(0);

    // Background parade of creatures
    const textures = ['en_compy', 'en_raptor', 'en_dilo', 'en_pachy', 'en_carno', 'dino_trex', 'dino_raptor', 'dino_tri', 'en_compy', 'en_compy'];
    for (let i = 0; i < 16; i++) {
      const t = textures[i % textures.length];
      const img = this.add.image(Math.random() * GAME_WIDTH, 380 + Math.random() * 320, t).setAlpha(0.35).setScale(1.2);
      this.walkers.push({ img, speed: 30 + Math.random() * 60 });
    }

    const title = this.add.text(GAME_WIDTH / 2, 150, 'DINO MUTATION', {
      fontFamily: FONT_BOLD, fontSize: '84px', color: '#ffcf6a', stroke: '#2a1a08', strokeThickness: 14,
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, scale: 1.03, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.easeInOut' });
    text(this, GAME_WIDTH / 2, 225, 'Roguelite de mutações jurássicas', 22, '#e8dcc0', true).setOrigin(0.5);

    button(this, GAME_WIDTH / 2, 340, 'JOGAR', () => this.go(), { width: 300, height: 70, fontSize: 30 });

    const save = loadSave();
    const info = save.runs > 0
      ? `Runs: ${save.runs}   ·   Vitórias: ${save.wins}   ·   Melhor tempo: ${formatTime(save.bestTime)}${save.bestEra ? `   ·   Melhor Era: ${save.bestEra}` : ''}`
      : 'Escolha um dinossauro, sobreviva, mute e derrote o Giganotosaurus.';
    text(this, GAME_WIDTH / 2, 420, info, 17, COLORS.muted).setOrigin(0.5);

    text(this, GAME_WIDTH / 2, GAME_HEIGHT - 70, prefersTouch()
      ? 'Arraste o dedo: mover   ·   Ataque automático   ·   Botão à direita: habilidade   ·   ❚❚: pausa'
      : 'WASD / Setas: mover   ·   Ataque automático   ·   SPACE: habilidade   ·   ESC: pausa', 16, '#d8d0b8').setOrigin(0.5);

    this.input.keyboard?.once('keydown-ENTER', () => this.go());
    this.input.keyboard?.once('keydown-SPACE', () => this.go());
    this.cameras.main.fadeIn(300);
  }

  private go(): void {
    this.scene.start('CharacterSelect');
  }

  update(_t: number, delta: number): void {
    const dt = delta / 1000;
    for (const w of this.walkers) {
      w.img.x += w.speed * dt;
      if (w.img.x > GAME_WIDTH + 80) w.img.x = -80;
    }
  }
}
