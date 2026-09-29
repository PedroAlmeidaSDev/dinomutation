import Phaser from 'phaser';
import { ENDLESS_CONFIG } from '../../data/endless';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { designOffset, fitShade } from './layout';
import { COLORS, FONT, WEIGHT, button, drawPanel, text, title as titleText } from './theme';

/**
 * Shown when the story boss falls: end the run as a victory, or continue into the
 * endless mode. Keys: ENTER = continue, ESC = end.
 */
export class VictoryChoice {
  private readonly root: Phaser.GameObjects.Container;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private keyHandler?: (e: KeyboardEvent) => void;
  private closed = false;
  private readonly readyAt: number;

  constructor(private readonly scene: Phaser.Scene, private readonly onContinue: () => void, private readonly onEnd: () => void) {
    this.readyAt = scene.time.now + 500;
    const cx = GAME_WIDTH / 2;
    const shade = this.shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.82).setOrigin(0).setInteractive();
    const title = titleText(scene, cx, 150, 'VITÓRIA!', 72, COLORS.acid).setOrigin(0.5);
    const sub = text(scene, cx, 222, 'O Giganotosaurus caiu. A vitória já está registrada.', 19, COLORS.muted).setOrigin(0.5);

    // The endless mode keeps its purple identity (Era mutations, mutagen).
    const panel = scene.add.graphics();
    drawPanel(panel, cx - 370, 266, 740, 180, { cut: 16, stroke: 0xc070ff, strokeAlpha: 0.7, accent: 0xc070ff });
    const endlessTitle = text(scene, cx, 292, 'ERA SEM FIM', 24, '#e0a0ff', true).setOrigin(0.5, 0).setLetterSpacing(3);
    const minutes = ENDLESS_CONFIG.eraLength / 60;
    const desc = scene.add.text(cx, 334, [
      `Eras de ${minutes} minutos que terminam com um Giganotosaurus cada vez mais forte.`,
      'Inimigos crescem a cada Era; da Era 3 em diante, mutações mudam as regras.',
      'Você ganha uma mutação LENDÁRIA agora e a cada chefe derrotado.',
    ].join('\n'), {
      fontFamily: FONT, fontStyle: WEIGHT.regular, fontSize: '17px', color: COLORS.text, align: 'center', lineSpacing: 6,
    }).setOrigin(0.5, 0);

    const cont = button(scene, cx - 170, 510, 'CONTINUAR (ENTER)', () => this.choose(true), { width: 310, height: 58, fontSize: 19, color: 0xc070ff });
    const end = button(scene, cx + 170, 510, 'ENCERRAR (ESC)', () => this.choose(false), { width: 280, height: 58, fontSize: 19, ghost: true });

    this.root = scene.add.container(0, 0, [shade, title, sub, panel, endlessTitle, desc, cont, end]).setDepth(1100).setAlpha(0);
    this.layout();
    scene.tweens.add({ targets: this.root, alpha: 1, duration: 250 });
    title.setScale(1.5);
    scene.tweens.add({ targets: title, scale: 1, duration: 450, ease: 'Back.easeOut' });

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') this.choose(true);
      else if (e.code === 'Escape') this.choose(false);
    };
    scene.input.keyboard?.on('keydown', this.keyHandler);
  }

  /** Centres the content in the current screen; the shade covers all of it. */
  layout(): void {
    if (this.closed) return;
    const o = designOffset(this.scene);
    this.root.setPosition(o.x, o.y);
    fitShade(this.shade, this.scene);
  }

  private choose(continueEndless: boolean): void {
    if (this.closed || this.scene.time.now < this.readyAt) return;
    this.close();
    if (continueEndless) this.onContinue();
    else this.onEnd();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.keyHandler) this.scene.input.keyboard?.off('keydown', this.keyHandler);
    this.root.destroy();
  }
}
