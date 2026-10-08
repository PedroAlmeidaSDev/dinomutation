import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { CURRENT_PATCH } from '../../data/patchNotes';
import { saveStore } from '../core/save/SaveStore';
import { formatTime } from '../../utils/math';
import { PatchNotes } from '../ui/PatchNotes';
import { centerDesign, designOffset, onLayout, safeInsets } from '../ui/layout';
import { COLORS, button, fullscreenButton, text, title as titleText } from '../ui/theme';
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
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.72),
    ]);

    // Background parade of creatures
    const textures = ['en_compy', 'en_raptor', 'en_dilo', 'en_pachy', 'en_carno', 'dino_trex', 'dino_raptor', 'dino_tri', 'en_compy', 'en_compy'];
    for (let i = 0; i < 16; i++) {
      const t = textures[i % textures.length];
      const img = this.add.image(Math.random() * GAME_WIDTH, 380 + Math.random() * 320, t).setAlpha(0.35).setScale(1.2);
      this.walkers.push({ img, speed: 30 + Math.random() * 60 });
    }

    // Two-tone logo: "Dino" in cream, "Mutation" in lava.
    const dino = titleText(this, 0, 0, 'Dino', 88).setOrigin(0, 0.5);
    const mutation = titleText(this, 0, 0, 'Mutation', 88, COLORS.accent).setOrigin(0, 0.5);
    const logoW = dino.width + mutation.width;
    dino.setX(-logoW / 2);
    mutation.setX(-logoW / 2 + dino.width);
    const title = this.add.container(GAME_WIDTH / 2, 160, [dino, mutation]);
    this.tweens.add({ targets: title, scale: 1.02, yoyo: true, repeat: -1, duration: 1600, ease: 'Sine.easeInOut' });
    text(this, GAME_WIDTH / 2, 222, 'ROGUELITE DE MUTAÇÕES JURÁSSICAS', 16, COLORS.muted, true).setOrigin(0.5).setLetterSpacing(4);

    const save = saveStore().current();
    button(this, GAME_WIDTH / 2, 320, 'JOGAR', () => this.go(), { width: 300, height: 64, fontSize: 28 }).setDepth(1);
    button(this, GAME_WIDTH / 2, 396, 'COVIL', () => this.scene.start('Lair'), { width: 300, height: 50, fontSize: 19, ghost: true }).setDepth(1);
    button(this, GAME_WIDTH / 2, 458, `NOVIDADES · v${CURRENT_PATCH.version}`, () => this.showNotes(), { width: 300, height: 44, fontSize: 15, ghost: true, color: COLORS.acid }).setDepth(1);

    const info = save.runs > 0
      ? `Runs ${save.runs}   ·   Vitórias ${save.wins}   ·   Melhor tempo ${formatTime(save.bestTime)}${save.bestEra ? `   ·   Melhor Era ${save.bestEra}` : ''}`
      : 'Escolha um dinossauro, sobreviva, mute e derrote o Giganotosaurus.';
    text(this, GAME_WIDTH / 2, 526, info, 15, COLORS.muted).setOrigin(0.5).setDepth(1);
    if (save.fossils > 0) text(this, GAME_WIDTH / 2, 552, `${save.fossils} FÓSSEIS`, 16, COLORS.acidText, true).setOrigin(0.5).setDepth(1).setLetterSpacing(2);

    text(this, GAME_WIDTH / 2, GAME_HEIGHT - 44, prefersTouch()
      ? 'Arraste o dedo: mover   ·   Ataque automático   ·   Botão à direita: habilidade   ·   ❚❚: pausa'
      : 'WASD / Setas: mover   ·   Ataque automático   ·   SPACE: habilidade   ·   ESC: pausa', 14, COLORS.dim).setOrigin(0.5).setDepth(1);

    const fs = fullscreenButton(this, 0, 0)?.setScrollFactor(0);
    if (fs) onLayout(this, (v) => fs.setPosition(v.width - 44 - safeInsets(this).right, 44));

    this.input.keyboard?.on('keydown-ENTER', () => this.go());
    this.input.keyboard?.on('keydown-SPACE', () => this.go());
    this.cameras.main.fadeIn(300);

    // Returning players see what changed once per version; brand-new players skip it.
    if (save.seenPatch !== CURRENT_PATCH.version) {
      if (save.runs > 0) this.time.delayedCall(350, () => this.showNotes());
      else saveStore().markPatchSeen(CURRENT_PATCH.version);
    }
  }

  private showNotes(): void {
    if (this.notes?.isOpen || this.leaving) return;
    this.notes = new PatchNotes(this, CURRENT_PATCH, () => {
      this.notesClosedAt = this.time.now;
      saveStore().markPatchSeen(CURRENT_PATCH.version);
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
