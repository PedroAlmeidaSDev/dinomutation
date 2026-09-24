import Phaser from 'phaser';
import type { RunContext } from '../../core/RunContext';
import { weightedPick } from '../../../utils/math';
import type { Enemy, EnemyBehavior } from './Enemy';
import { resolveCircle, resolveCone, slamFx } from './attacks';

type Attack = 'bite' | 'charge' | 'roar' | 'stomp' | 'summon';
type State = 'walk' | 'windup' | 'charging' | 'recover' | 'rage';

/**
 * Final boss. Five telegraphed patterns and a second, enraged phase at 50% HP.
 */
export class GiganotosaurusBehavior implements EnemyBehavior {
  private state: State = 'walk';
  private timer = 2;
  private attack: Attack = 'bite';
  private last: Attack | null = null;
  private angle = 0;
  private phase: 1 | 2 = 1;
  private summonCd = 8;
  private stompSpots: { x: number; y: number }[] = [];
  private aura?: Phaser.GameObjects.Image;
  private fightTime = 0;
  private enraged = false;

  onSpawn(e: Enemy, ctx: RunContext): void {
    this.aura = ctx.scene.add.image(0, 0, 'glow').setTint(0xff6020).setBlendMode(Phaser.BlendModes.ADD).setScale(e.radius / 14).setAlpha(0.35);
    e.extras.add(this.aura);
    ctx.scene.tweens.add({ targets: this.aura, alpha: { from: 0.2, to: 0.5 }, yoyo: true, repeat: -1, duration: 900 });
  }

  private get speedMult(): number {
    return this.phase === 2 ? 1.3 : 1;
  }

  private windupMult(e: Enemy): number {
    return (this.phase === 2 ? 0.78 : 1) * (this.enraged ? e.def.params.enrageWindup : 1);
  }

  update(e: Enemy, dt: number, ctx: RunContext): void {
    const p = e.def.params;
    this.timer -= dt;
    this.summonCd -= dt;
    this.fightTime += dt;

    // Soft DPS check: a long fight makes the boss hit harder and faster.
    if (!this.enraged && this.fightTime >= p.enrageTime) this.enrage(e, ctx);

    if (this.phase === 1 && e.hpRatio <= 0.5 && this.state !== 'charging') {
      this.enterRage(e, ctx);
      return;
    }

    switch (this.state) {
      case 'walk':
        e.moveToward(ctx.player.x, ctx.player.y, this.speedMult, dt, ctx);
        if (this.timer <= 0) this.chooseAttack(e, ctx);
        break;
      case 'windup':
        e.faceTowards(this.angle, dt, 6);
        if (this.attack === 'charge') e.sprite.x += (Math.random() - 0.5) * 5;
        if (this.timer <= 0) this.executeAttack(e, ctx);
        break;
      case 'charging':
        e.moveAngle(this.angle, p.chargeSpeed * (this.phase === 2 ? 1.1 : 1), dt, ctx);
        ctx.fx.dust(e.x, e.y, 2);
        if (this.timer <= 0) this.endCharge(e, ctx);
        break;
      case 'rage':
        e.sprite.x += (Math.random() - 0.5) * 6;
        if (this.timer <= 0) {
          this.state = 'recover';
          this.timer = 0.6;
        }
        break;
      case 'recover':
        e.moveToward(ctx.player.x, ctx.player.y, 0.4 * this.speedMult, dt, ctx);
        if (this.timer <= 0) {
          this.state = 'walk';
          this.timer = p.attackCooldown * (this.phase === 2 ? 0.65 : 1);
        }
        break;
    }
  }

  onBlocked(e: Enemy, ctx: RunContext): void {
    if (this.state === 'charging') {
      ctx.fx.shake(0.012, 250);
      this.endCharge(e, ctx);
    }
  }

  private enterRage(e: Enemy, ctx: RunContext): void {
    this.phase = 2;
    this.state = 'rage';
    this.timer = 1.4;
    e.attackContactDamage = 0;
    e.ignoreSeparation = false;
    e.setBaseTint(0xff7060);
    this.aura?.setTint(0xff1010);
    ctx.bus.emit('banner', { text: 'FÚRIA DO GIGANOTOSAURUS', sub: 'Ataques mais rápidos e mais fortes', color: 0xff3020 });
    const p = e.def.params;
    resolveCircle(ctx, e, e.x, e.y, p.roarRadius, p.roarDamage, p.roarForce, false);
    ctx.fx.ring(e.x, e.y, p.roarRadius * 1.4, 0xff4020, 700);
    ctx.fx.shake(0.015, 500);
    ctx.hitstop(0.12);
  }

  private enrage(e: Enemy, ctx: RunContext): void {
    this.enraged = true;
    e.damageMult *= e.def.params.enrageDamage;
    this.aura?.setTint(0xff0040).setScale(e.radius / 11);
    ctx.bus.emit('banner', { text: 'O GIGANOTOSAURUS ENLOUQUECE', sub: 'Acabe com ele rápido!', color: 0xff1030 });
    ctx.fx.ring(e.x, e.y, 420, 0xff0040, 700);
    ctx.fx.shake(0.012, 600);
  }

  private chooseAttack(e: Enemy, ctx: RunContext): void {
    const p = e.def.params;
    const dist = e.distToPlayer(ctx);
    const close = dist < p.biteRange + ctx.player.radius;
    const options: { a: Attack; w: number }[] = [
      { a: 'bite', w: close ? 5 : 0 },
      { a: 'roar', w: close ? 2 : 0.5 },
      { a: 'stomp', w: 3 },
      { a: 'charge', w: close ? 1 : 5 },
      { a: 'summon', w: this.summonCd <= 0 ? 3 : 0 },
    ];
    const pick = weightedPick(options.filter((o) => o.a !== this.last), (o) => o.w) ?? options[2];
    this.beginAttack(e, ctx, pick.a);
  }

  private beginAttack(e: Enemy, ctx: RunContext, attack: Attack): void {
    const p = e.def.params;
    const wm = this.windupMult(e);
    this.attack = attack;
    this.last = attack;
    this.state = 'windup';
    this.angle = e.angleToPlayer(ctx);
    const T = ctx.telegraphs;
    switch (attack) {
      case 'bite':
        this.timer = p.biteWindup * wm;
        e.trackTelegraph(T.cone(e.x, e.y, this.angle, p.biteArc * (this.phase === 2 ? 1.25 : 1), p.biteRange, this.timer));
        break;
      case 'charge':
        this.timer = p.chargeWindup * wm;
        e.trackTelegraph(T.line(e.x, e.y, this.angle, p.chargeSpeed * p.chargeTime * 1.05, e.radius * 2, this.timer));
        break;
      case 'roar':
        this.timer = p.roarWindup * wm;
        e.trackTelegraph(T.circle(e.x, e.y, p.roarRadius, this.timer, 0xff8a2a));
        break;
      case 'stomp': {
        this.timer = p.stompWindup * wm;
        const n = p.stompCount + (this.phase === 2 ? 2 : 0);
        const r = p.stompRadius * (this.phase === 2 ? 1.2 : 1);
        this.stompSpots = [];
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = i === 0 ? 0 : 80 + Math.random() * 160;
          const x = ctx.player.x + ctx.player.vx * 0.4 + Math.cos(a) * d;
          const y = ctx.player.y + ctx.player.vy * 0.4 + Math.sin(a) * d;
          this.stompSpots.push({ x, y });
          e.trackTelegraph(T.circle(x, y, r, this.timer));
        }
        break;
      }
      case 'summon':
        this.timer = 0.8;
        this.summonCd = this.phase === 2 ? 11 : 15;
        e.trackTelegraph(T.circle(e.x, e.y, e.radius * 1.6, this.timer, 0xb070ff));
        break;
    }
  }

  private executeAttack(e: Enemy, ctx: RunContext): void {
    const p = e.def.params;
    switch (this.attack) {
      case 'bite':
        resolveCone(ctx, e, this.angle, p.biteArc * (this.phase === 2 ? 1.25 : 1), p.biteRange, p.biteDamage, 600);
        ctx.fx.bite(e.x + Math.cos(this.angle) * p.biteRange * 0.7, e.y + Math.sin(this.angle) * p.biteRange * 0.7, this.angle, 2.4, false);
        ctx.fx.shake(0.008, 160);
        break;
      case 'charge':
        this.state = 'charging';
        this.timer = p.chargeTime;
        e.attackContactDamage = p.chargeDamage;
        e.ignoreSeparation = true;
        return;
      case 'roar':
        resolveCircle(ctx, e, e.x, e.y, p.roarRadius, p.roarDamage, p.roarForce, false);
        ctx.fx.ring(e.x, e.y, p.roarRadius, 0xff8a2a, 500);
        ctx.fx.ring(e.x, e.y, p.roarRadius * 0.7, 0xffd060, 400);
        ctx.fx.shake(0.012, 350);
        break;
      case 'stomp': {
        const r = p.stompRadius * (this.phase === 2 ? 1.2 : 1);
        let hit = false;
        for (const s of this.stompSpots) {
          if (!hit) hit = resolveCircle(ctx, e, s.x, s.y, r, p.stompDamage, 380);
          slamFx(ctx, s.x, s.y, r, 0xff6030);
        }
        break;
      }
      case 'summon': {
        const count = p.summonCount + (this.phase === 2 ? 4 : 0);
        ctx.spawner.spawnAround('compy', e.x, e.y, count, e.radius + 60);
        ctx.spawner.spawnAround('wildRaptor', e.x, e.y, this.phase === 2 ? 3 : 2, e.radius + 90);
        if (this.phase === 2) ctx.spawner.spawnAround('dilophosaurus', e.x, e.y, 2, e.radius + 120);
        ctx.fx.ring(e.x, e.y, 260, 0xb070ff, 500);
        break;
      }
    }
    this.state = 'recover';
    this.timer = 0.7;
  }

  private endCharge(e: Enemy, ctx: RunContext): void {
    e.attackContactDamage = 0;
    e.ignoreSeparation = false;
    slamFx(ctx, e.x, e.y, 130, 0xff6030);
    resolveCircle(ctx, e, e.x, e.y, 130, 18, 400);
    this.state = 'recover';
    this.timer = 0.9;
  }
}
