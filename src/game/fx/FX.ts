import Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import { FONT, WEIGHT } from '../ui/theme';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

const NUMBER_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: FONT,
  fontStyle: WEIGHT.bold,
  fontSize: '16px',
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 4,
};

/**
 * All transient juice: particles, damage numbers, attack swooshes, shake.
 * Pure presentation — never changes game state.
 */
export class FX {
  private emitters: Record<string, Emitter> = {};
  private numberPool: Phaser.GameObjects.Text[] = [];
  private activeNumbers = 0;

  constructor(private readonly scene: Phaser.Scene) {
    const mk = (key: string, texture: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth = 60) => {
      const e = scene.add.particles(0, 0, texture, { emitting: false, ...cfg });
      e.setDepth(depth);
      this.emitters[key] = e;
    };
    mk('blood', 'px', { lifespan: { min: 250, max: 500 }, speed: { min: 60, max: 220 }, scale: { start: 1.3, end: 0.2 }, tint: [0xd01020, 0x9a0a18, 0xff3040], maxParticles: 400 });
    mk('spark', 'spark', { lifespan: { min: 150, max: 320 }, speed: { min: 150, max: 420 }, scale: { start: 1, end: 0 }, tint: [0xffffff, 0xffe070, 0xffb030], blendMode: 'ADD', rotate: { min: 0, max: 360 }, maxParticles: 300 }, 65);
    mk('dust', 'px', { lifespan: { min: 300, max: 600 }, speed: { min: 30, max: 140 }, scale: { start: 2, end: 0.5 }, alpha: { start: 0.6, end: 0 }, tint: [0xa89878, 0x807050], maxParticles: 300 }, 15);
    mk('poison', 'px', { lifespan: { min: 300, max: 700 }, speed: { min: 40, max: 160 }, scale: { start: 1.6, end: 0.2 }, tint: [0x90ff40, 0x50c020], blendMode: 'ADD', maxParticles: 300 });
    mk('dna', 'px', { lifespan: { min: 250, max: 500 }, speed: { min: 60, max: 180 }, scale: { start: 1.2, end: 0 }, tint: [0x60ffb0, 0x40d0ff], blendMode: 'ADD', maxParticles: 200 }, 66);
    mk('ghost', 'px', { lifespan: { min: 200, max: 450 }, speed: { min: 20, max: 90 }, scale: { start: 1.5, end: 0 }, tint: [0x60e0ff, 0xa0f0ff], blendMode: 'ADD', maxParticles: 250 }, 66);
    mk('gold', 'spark', { lifespan: { min: 300, max: 800 }, speed: { min: 120, max: 400 }, scale: { start: 1.3, end: 0 }, tint: [0xffe070, 0xffffff, 0xff9030], blendMode: 'ADD', rotate: { min: 0, max: 360 }, maxParticles: 250 }, 90);
    mk('purple', 'px', { lifespan: { min: 300, max: 700 }, speed: { min: 40, max: 200 }, scale: { start: 1.6, end: 0 }, tint: [0xc060ff, 0x8040ff], blendMode: 'ADD', maxParticles: 200 }, 66);
  }

  private burst(key: string, x: number, y: number, count: number): void {
    this.emitters[key]?.explode(count, x, y);
  }

  pause(): void {
    for (const e of Object.values(this.emitters)) e.pause();
  }

  resume(): void {
    for (const e of Object.values(this.emitters)) e.resume();
  }

  shake(intensity: number, duration = 100): void {
    this.scene.cameras.main.shake(duration, intensity);
  }

  // ---------- numbers ----------

  damageNumber(x: number, y: number, amount: number, crit: boolean, execute: boolean, dotTag?: string): void {
    if (this.activeNumbers >= BALANCE.feel.maxDamageNumbers && !crit) return;
    const t = this.numberPool.pop() ?? this.scene.add.text(0, 0, '', NUMBER_STYLE).setOrigin(0.5).setDepth(200);
    this.activeNumbers++;
    let color = '#ffffff';
    let size = 15;
    let label = `${amount}`;
    if (dotTag === 'bleed') { color = '#ff5566'; size = 12; }
    else if (dotTag === 'poison') { color = '#9cff5a'; size = 12; }
    if (crit) { color = '#ffd23a'; size = 22 + Math.min(10, amount / 40); label = `${amount}!`; }
    if (execute) { color = '#ff2a2a'; size = 24; label = `✖ ${amount}`; }
    t.setText(label).setColor(color).setFontSize(size).setPosition(x + Phaser.Math.Between(-10, 10), y).setAlpha(1).setScale(crit ? 1.5 : 1).setVisible(true).setActive(true);
    this.scene.tweens.add({
      targets: t,
      y: y - (crit ? 46 : 30),
      scale: 1,
      duration: crit ? 520 : 420,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: t, alpha: 0, duration: 160,
          onComplete: () => {
            t.setVisible(false).setActive(false);
            this.numberPool.push(t);
            this.activeNumbers--;
          },
        });
      },
    });
  }

  floatText(x: number, y: number, text: string, color = '#ffffff', size = 18): void {
    const t = this.scene.add.text(x, y, text, { ...NUMBER_STYLE, fontSize: `${size}px`, color }).setOrigin(0.5).setDepth(210);
    this.scene.tweens.add({ targets: t, y: y - 50, alpha: { from: 1, to: 0 }, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  playerHurt(x: number, y: number, amount: number): void {
    this.burst('blood', x, y, 8);
    if (amount > 0) this.floatText(x, y - 30, `-${amount}`, '#ff4a4a', 16);
  }

  // ---------- attack visuals ----------

  bite(x: number, y: number, angle: number, scale: number, bloody: boolean): void {
    const upper = this.scene.add.image(0, -16, 'jaw').setOrigin(0.5, 1);
    const lower = this.scene.add.image(0, 16, 'jaw').setOrigin(0.5, 1).setFlipY(true).setOrigin(0.5, 0);
    const c = this.scene.add.container(x, y, [upper, lower]).setRotation(angle + Math.PI / 2).setScale(scale).setDepth(62);
    if (bloody) { upper.setTint(0xffb0b0); lower.setTint(0xffb0b0); }
    this.scene.tweens.add({ targets: upper, y: -2, duration: 70, ease: 'Quad.easeIn' });
    this.scene.tweens.add({
      targets: lower, y: 2, duration: 70, ease: 'Quad.easeIn',
      onComplete: () => {
        this.burst(bloody ? 'blood' : 'spark', x, y, bloody ? 10 : 5);
        this.scene.tweens.add({ targets: c, alpha: 0, scale: scale * 1.15, duration: 140, onComplete: () => c.destroy() });
      },
    });
  }

  claw(x: number, y: number, angle: number, scale: number, color = 0xffffff): void {
    const img = this.scene.add.image(x, y, 'claw3').setRotation(angle + Phaser.Math.FloatBetween(-0.5, 0.5)).setScale(scale * 0.6).setTint(color).setDepth(62).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: img, scale: scale * 1.05, alpha: { from: 1, to: 0 }, duration: 160, onComplete: () => img.destroy() });
  }

  swipe(x: number, y: number, angle: number, range: number, arc: number, color = 0xffffff): void {
    const img = this.scene.add.image(x, y, 'swipe').setOrigin(0, 0.5).setRotation(angle).setTint(color).setDepth(61).setBlendMode(Phaser.BlendModes.ADD);
    const sx = range / 128;
    img.setScale(sx * 0.6, sx * 0.6 * (arc / 1.6));
    this.scene.tweens.add({ targets: img, scaleX: sx, scaleY: sx * (arc / 1.6), alpha: { from: 0.9, to: 0 }, duration: 170, ease: 'Quad.easeOut', onComplete: () => img.destroy() });
  }

  ring(x: number, y: number, radius: number, color: number, duration = 380, thickness = 1): void {
    const img = this.scene.add.image(x, y, 'ring').setTint(color).setDepth(61).setBlendMode(Phaser.BlendModes.ADD).setScale(0.1).setAlpha(thickness);
    this.scene.tweens.add({ targets: img, scale: radius / 64, alpha: 0, duration, ease: 'Cubic.easeOut', onComplete: () => img.destroy() });
  }

  explosion(x: number, y: number, radius: number, color: number, particles: 'blood' | 'poison' | 'spark' | 'purple' | 'dust' = 'spark'): void {
    const img = this.scene.add.image(x, y, 'glow').setTint(color).setDepth(61).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2);
    this.scene.tweens.add({ targets: img, scale: radius / 32, alpha: { from: 0.95, to: 0 }, duration: 320, ease: 'Cubic.easeOut', onComplete: () => img.destroy() });
    this.ring(x, y, radius, color, 300);
    this.burst(particles, x, y, Math.min(24, 8 + radius / 10));
  }

  // ---------- events ----------

  critBurst(x: number, y: number): void {
    this.burst('spark', x, y, 8);
  }

  hitSpark(x: number, y: number): void {
    this.burst('spark', x, y, 3);
  }

  bleedDrip(x: number, y: number): void {
    this.burst('blood', x, y, 2);
  }

  poisonPuff(x: number, y: number): void {
    this.burst('poison', x, y, 6);
  }

  ghostTrail(x: number, y: number): void {
    this.burst('ghost', x, y, 2);
  }

  dust(x: number, y: number, count = 6): void {
    this.burst('dust', x, y, count);
  }

  enemyDeath(x: number, y: number, radius: number, bleeding: boolean): void {
    this.burst(bleeding ? 'blood' : 'dust', x, y, Math.min(26, 6 + radius / 2));
    if (bleeding) this.burst('blood', x, y, 6);
  }

  dnaCollect(x: number, y: number): void {
    this.burst('dna', x, y, 3);
  }

  levelUp(x: number, y: number): void {
    this.burst('gold', x, y, 40);
    this.ring(x, y, 160, 0xffe070, 600);
  }

  fearBurst(x: number, y: number): void {
    this.burst('purple', x, y, 10);
  }

  bigExplosion(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      this.scene.time.delayedCall(i * 120, () => {
        const ox = x + Phaser.Math.Between(-60, 60);
        const oy = y + Phaser.Math.Between(-60, 60);
        this.explosion(ox, oy, 120, 0xff8030, 'spark');
        this.burst('blood', ox, oy, 20);
      });
    }
  }
}
