import type Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import type { RunContext } from '../core/RunContext';
import type { Enemy } from '../entities/enemies/Enemy';

export interface EnemyProjectileSpec {
  x: number;
  y: number;
  angle: number;
  speed: number;
  damage: number;
  texture: string;
  radius: number;
  attacker?: Enemy;
  poisonStacks?: number;
  spin?: boolean;
  life?: number;
}

interface Projectile {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  damage: number;
  poisonStacks: number;
  spin: boolean;
  attacker?: Enemy;
  dead: boolean;
}

/** Enemy projectiles (spit, rocks). Removed on hit, obstacle, lifetime or leaving the world. */
export class ProjectileSystem {
  private list: Projectile[] = [];

  constructor(private readonly ctx: RunContext) {}

  spawnEnemy(spec: EnemyProjectileSpec): void {
    const sprite = this.ctx.scene.add.image(spec.x, spec.y, spec.texture).setDepth(75).setRotation(spec.angle);
    this.list.push({
      sprite,
      x: spec.x,
      y: spec.y,
      vx: Math.cos(spec.angle) * spec.speed,
      vy: Math.sin(spec.angle) * spec.speed,
      radius: spec.radius,
      life: spec.life ?? 3,
      damage: spec.damage,
      poisonStacks: spec.poisonStacks ?? 0,
      spin: !!spec.spin,
      attacker: spec.attacker,
      dead: false,
    });
  }

  update(dt: number): void {
    const { player, collision } = this.ctx;
    const W = BALANCE.world.width;
    const H = BALANCE.world.height;
    for (const p of this.list) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.sprite.setPosition(p.x, p.y);
      if (p.spin) p.sprite.rotation += dt * 10;

      if (p.life <= 0 || p.x < 0 || p.y < 0 || p.x > W || p.y > H || collision.pointBlocked(p.x, p.y, p.radius * 0.5)) {
        p.dead = true;
        continue;
      }
      if (player.isAlive() && Math.hypot(player.x - p.x, player.y - p.y) < player.radius + p.radius) {
        const taken = this.ctx.damage.hitPlayer({ amount: p.damage, tags: ['projectile'], attacker: undefined });
        if (taken > 0 && p.poisonStacks > 0) {
          this.ctx.status.apply(player, 'poison', { stacks: p.poisonStacks, source: 'enemy', duration: BALANCE.statuses.enemyPoisonOnPlayer.duration });
          this.ctx.fx.poisonPuff(p.x, p.y);
        }
        p.dead = true;
      }
    }
    if (this.list.some((p) => p.dead)) {
      for (const p of this.list) if (p.dead) p.sprite.destroy();
      this.list = this.list.filter((p) => !p.dead);
    }
  }

  clear(): void {
    for (const p of this.list) p.sprite.destroy();
    this.list = [];
  }
}
