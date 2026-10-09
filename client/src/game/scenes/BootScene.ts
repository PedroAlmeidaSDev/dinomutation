import Phaser from 'phaser';
import { API_ENABLED } from '../../net/env';
import { generateTextures, loadSprites } from '../art/Textures';
import { saveStore, setSaveStore } from '../core/save/SaveStore';
import { hasLoginFlag, resumeSession } from '../core/save/session';
import { COLORS, button, text } from '../ui/theme';

/** Free hosting puts the API to sleep; waking it can take a while. */
const GUEST_OFFER_MS = 8000;
const RETRY_MS = 3000;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    loadSprites(this);
  }

  create(): void {
    generateTextures(this);
    if (API_ENABLED && hasLoginFlag()) this.connect();
    else this.scene.start('Menu');
  }

  /** Signed-in players wait for the API; after a few seconds they may go on as guests. */
  private connect(): void {
    const { width, height } = this.scale;
    const status = text(this, width / 2, height / 2, 'Conectando…', 22, COLORS.muted, true).setOrigin(0.5);
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      this.scene.start('Menu');
    };
    this.time.delayedCall(GUEST_OFFER_MS, () => {
      if (done) return;
      status.setText('O servidor está demorando para responder…');
      // The session is kept: next visit tries again.
      button(this, width / 2, height / 2 + 70, 'JOGAR COMO VISITANTE', go, { width: 340, height: 54, fontSize: 18, ghost: true });
    });
    const attempt = async (): Promise<void> => {
      const before = saveStore();
      const result = await resumeSession();
      if (done) {
        // The player already chose to go on as a guest: don't swap the save mid-game. If they
        // signed in meanwhile, resumeSession left their session alone ('superseded').
        if (result === 'cloud') setSaveStore(before);
        return;
      }
      if (result === 'offline') {
        this.time.delayedCall(RETRY_MS, () => void attempt());
        return;
      }
      go();
    };
    void attempt();
  }
}
