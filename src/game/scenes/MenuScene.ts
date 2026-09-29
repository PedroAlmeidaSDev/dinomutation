import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { CURRENT_PATCH } from '../../data/patchNotes';
import { loadSave, markPatchSeen } from '../core/Save';
import { formatTime } from '../../utils/math';
import { PatchNotes } from '../ui/PatchNotes';
import { centerDesign, designOffset, onLayout, safeInsets } from '../ui/layout';
import { COLORS, button, fullscreenButton, panel, text, title as titleText } from '../ui/theme';
import { prefersTouch } from '../ui/TouchControls';

export class MenuScene extends Phaser.Scene {
  private walkers: { img: Phaser.GameObjects.Image; speed: number }[] = [];
  private notes: PatchNotes | null = null;
  /** Keys that close the patch notes must not also start the game. */
  private notesClosedAt = -Infinity;
  private leaving = false;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.walkers = [];
    this.notes = null;
    this.leaving = false;
    centerDesign(this, [
      this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'ground').setAlpha(0.6),
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0c08, 0.45),
    ]);

    // Background parade of creatures
    const textures = ['en_compy', 'en_raptor', 'en_dilo', 'en_pachy', 'en_carno', 'dino_trex', 'dino_raptor', 'dino_tri', 'en_compy', 'en_compy'];
    for (let i = 0; i < 16; i++) {
      const t = textures[i % textures.length];
      const img = this.add.image(Math.random() * GAME_WIDTH, 380 + Math.random() * 320, t).setAlpha(0.35).setScale(1.2);
      this.walkers.push({ img, speed: 30 + Math.random() * 60 });
    }

    const title = this.add.container(GAME_WIDTH / 2, 150, [
      titleText(this, 0, 0, 'DINO MUTATION', 96, COLORS.accent).setOrigin(0.5),
    ]);
    this.tweens.add({ targets: title, scale: 1.03, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.easeInOut' });
    const tagW = 460;
    panel(this, GAME_WIDTH / 2 - tagW / 2, 212, tagW, 40, { radius: 20, border: 3, shadow: 4, fill: 0x5a3a1c });
    text(this, GAME_WIDTH / 2, 230, 'Roguelite de mutações jurássicas', 21, '#ffe8c0', true).setOrigin(0.5);

    const save = loadSave();
    const info = save.runs > 0
      ? `Runs: ${save.runs}   ·   Vitórias: ${save.wins}   ·   Melhor tempo: ${formatTime(save.bestTime)}${save.bestEra ? `   ·   Melhor Era: ${save.bestEra}` : ''}`
      : 'Escolha um dinossauro, sobreviva, mute e derrote o Giganotosaurus.';
    const infoText = text(this, GAME_WIDTH / 2, 462, info, 16, COLORS.text).setOrigin(0.5);
    const plaqueW = Math.max(460, infoText.width + 60);
    panel(this, GAME_WIDTH / 2 - plaqueW / 2, 280, plaqueW, 300);
    infoText.setDepth(1);
    if (save.fossils > 0) text(this, GAME_WIDTH / 2, 490, `Fósseis: ${save.fossils}`, 18, COLORS.accentText, true).setOrigin(0.5).setDepth(1);

    button(this, GAME_WIDTH / 2, 330, 'JOGAR', () => this.go(), { width: 300, height: 70, fontSize: 32 }).setDepth(1);
    button(this, GAME_WIDTH / 2, 412, 'COVIL', () => this.scene.start('Lair'), { width: 240, height: 54, fontSize: 22, color: 0xc49a4a }).setDepth(1);
    button(this, GAME_WIDTH / 2, 545, `NOVIDADES · v${CURRENT_PATCH.version}`, () => this.showNotes(), { width: 270, height: 46, fontSize: 17, color: 0x6f8a4a }).setDepth(1);

    const hint = text(this, GAME_WIDTH / 2, GAME_HEIGHT - 52, prefersTouch()
      ? 'Arraste o dedo: mover   ·   Ataque automático   ·   Botão à direita: habilidade   ·   ❚❚: pausa'
      : 'WASD / Setas: mover   ·   Ataque automático   ·   SPACE: habilidade   ·   ESC: pausa', 15, '#e8dcc0').setOrigin(0.5).setDepth(1);
    panel(this, GAME_WIDTH / 2 - hint.width / 2 - 24, GAME_HEIGHT - 72, hint.width + 48, 40, { radius: 20, border: 3, shadow: 3, alpha: 0.85 });

    const fs = fullscreenButton(this, 0, 0)?.setScrollFactor(0);
    if (fs) onLayout(this, (v) => fs.setPosition(v.width - 44 - safeInsets(this).right, 44));

    this.input.keyboard?.on('keydown-ENTER', () => this.go());
    this.input.keyboard?.on('keydown-SPACE', () => this.go());
    this.cameras.main.fadeIn(300);

    // Returning players see what changed once per version; brand-new players skip it.
    if (save.seenPatch !== CURRENT_PATCH.version) {
      if (save.runs > 0) this.time.delayedCall(350, () => this.showNotes());
      else markPatchSeen(CURRENT_PATCH.version);
    }
  }

  private showNotes(): void {
    if (this.notes?.isOpen || this.leaving) return;
    this.notes = new PatchNotes(this, CURRENT_PATCH, () => {
      this.notesClosedAt = this.time.now;
      markPatchSeen(CURRENT_PATCH.version);
    });
  }

  private go(): void {
    if (this.leaving || this.notes?.isOpen || this.time.now - this.notesClosedAt < 250) return;
    this.leaving = true;
    this.scene.start('CharacterSelect');
  }

  update(_t: number, delta: number): void {
    const dt = delta / 1000;
    const ox = designOffset(this).x;
    for (const w of this.walkers) {
      w.img.x += w.speed * dt;
      if (w.img.x > GAME_WIDTH + ox + 80) w.img.x = -ox - 80;
    }
  }
}
