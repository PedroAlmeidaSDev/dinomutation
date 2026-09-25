import Phaser from 'phaser';
import type { RunContext } from '../core/RunContext';
import type { Enemy } from '../entities/enemies/Enemy';

export interface GhostSpec {
  /** Multiplier of player damage per hit. */
  coef: number;
  /** Number of hits before vanishing (Infinity with a lifetime for Matilha). */
  hits: number;
  life: number;
  attackCooldown: number;
}

interface Ghost {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  angle: number;
  target?: Enemy;
  spec: GhostSpec;
  hitsLeft: number;
  life: number;
  cd: number;
  dead: boolean;
}

/** Spectral raptors (Matilha Fantasma / Matilha). Their hits use the normal damage pipeline. */
export class SummonSystem {
  private ghosts: Ghost[] = [];

  constructor(private readonly ctx: RunContext) {}

  get count(): number {
    return this.ghosts.length;
  }

  spawnGhost(spec: GhostSpec): void {
    const p = this.ctx.player;
    const a = Math.random() * Math.PI * 2;
    const x = p.x + Math.cos(a) * 30;
    const y = p.y + Math.sin(a) * 30;
    const sprite = this.ctx.scene.add.image(x, y, 'dino_raptor')
      .setTintFill(0x60e0ff).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(55).setScale(0.9);
    this.ghosts.push({ sprite, x, y, angle: a, spec, hitsLeft: spec.hits, life: spec.life, cd: 0, dead: false });
    this.ctx.fx.ghostTrail(x, y);
  }

  update(dt: number): void {
    const ctx = this.ctx;
    for (const g of this.ghosts) {
      g.life -= dt;
      g.cd -= dt;
      if (g.life <= 0 || g.hitsLeft <= 0) {
        g.dead = true;
        continue;
      }
      if (!g.target || g.target.dead) {
        g.target = ctx.nearestEnemy(g.x, g.y, 520, (e) => !e.dead);
      }
      const t = g.target;
      if (t) {
        const d = Math.hypot(t.x - g.x, t.y - g.y);
        g.angle = Math.atan2(t.y - g.y, t.x - g.x);
        if (d > t.radius + 12) {
          const s = 560 * dt;
          g.x += Math.cos(g.angle) * Math.min(s, d);
          g.y += Math.sin(g.angle) * Math.min(s, d);
        } else if (g.cd <= 0) {
          g.cd = g.spec.attackCooldown;
          g.hitsLeft--;
          ctx.damage.hitEnemy({
            target: t,
            base: ctx.player.stats.get('damage') * g.spec.coef * ctx.player.stats.get('summonDamage'),
            tags: ['summon', 'claw', 'physical'],
            source: 'summon',
            knockback: 60,
            knockAngle: g.angle,
            depth: 1,
          });
          ctx.fx.claw(t.x, t.y, g.angle, 0.9, 0x80f0ff);
          if (g.hitsLeft > 0) g.target = undefined; // hop to the next victim
        }
      } else {
        // idle: orbit the player
        const p = ctx.player;
        const oa = Math.atan2(g.y - p.y, g.x - p.x) + dt * 2;
        g.x += (p.x + Math.cos(oa) * 60 - g.x) * Math.min(1, dt * 5);
        g.y += (p.y + Math.sin(oa) * 60 - g.y) * Math.min(1, dt * 5);
      }
      g.sprite.setPosition(g.x, g.y).setRotation(g.angle);
      g.sprite.setAlpha(0.45 + Math.min(0.35, g.life));
      if (Math.random() < 0.3) ctx.fx.ghostTrail(g.x, g.y);
    }
    if (this.ghosts.some((g) => g.dead)) {
      for (const g of this.ghosts) {
        if (!g.dead) continue;
        ctx.fx.ghostTrail(g.x, g.y);
        g.sprite.destroy();
      }
      this.ghosts = this.ghosts.filter((g) => !g.dead);
    }
  }

  clear(): void {
    for (const g of this.ghosts) g.sprite.destroy();
    this.ghosts = [];
  }
}
