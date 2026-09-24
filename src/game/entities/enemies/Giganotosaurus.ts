import Phaser from 'phaser';
import type { RunContext } from '../../core/RunContext';
import { angleDiff, weightedPick } from '../../../utils/math';
import type { Enemy, EnemyBehavior } from './Enemy';
import { resolveCircle, resolveCone, slamFx } from './attacks';

type Attack = 'bite' | 'comboBite' | 'charge' | 'roar' | 'stomp' | 'summon' | 'tailSweep' | 'quake';
type State = 'walk' | 'windup' | 'charging' | 'recover' | 'transition' | 'stunned' | 'quake';
type Phase = 1 | 2 | 3;

/** Per-phase tempo: movement speed, windup and cooldown multipliers. */
const TEMPO: Record<Phase, { speed: number; windup: number; cooldown: number; summonCd: number }> = {
  1: { speed: 1, windup: 1, cooldown: 1, summonCd: 15 },
  2: { speed: 1.2, windup: 0.85, cooldown: 0.75, summonCd: 12 },
  3: { speed: 1.35, windup: 0.75, cooldown: 0.6, summonCd: 10 },
};

interface PendingHit { x: number; y: number; r: number; damage: number; t: number }
interface Shockwave { x: number; y: number; r: number; delay: number; hit: boolean }

/**
 * Final boss, three phases:
 *  1 Caçador (100–66%): bite, combo bite, charge, roar, stomp, summons.
 *  2 Fúria (66–33%): charges chain ×3, tail sweep punishes standing behind, roar slows.
 *  3 Predador Supremo (<33%): quake (falling rocks), stomp becomes expanding shockwaves,
 *    3-bite combo, summons a Carnotaurus.
 * Charging into a rock or wall leaves it stunned and vulnerable — the reward for baiting.
 * After `enrageTime` seconds it enrages regardless of phase (soft DPS check).
 */
export class GiganotosaurusBehavior implements EnemyBehavior {
  private state: State = 'walk';
  private timer = 2;
  private attack: Attack = 'bite';
  private last: Attack | null = null;
  private angle = 0;
  private phase: Phase = 1;
  private summonCd = 8;
  private stompSpots: { x: number; y: number }[] = [];
  private bitesLeft = 0;
  private chargesLeft = 0;
  private behindTime = 0;
  private quakeTick = 0;
  private pending: PendingHit[] = [];
  private shockwaves: Shockwave[] = [];
  private shockGfx?: Phaser.GameObjects.Graphics;
  private aura?: Phaser.GameObjects.Image;
  private fightTime = 0;
  private enraged = false;

  onSpawn(e: Enemy, ctx: RunContext): void {
    e.ccResist = e.def.params.ccResist;
    this.aura = ctx.scene.add.image(0, 0, 'glow').setTint(0xff6020).setBlendMode(Phaser.BlendModes.ADD).setScale(e.radius / 14).setAlpha(0.35);
    e.extras.add(this.aura);
    ctx.scene.tweens.add({ targets: this.aura, alpha: { from: 0.2, to: 0.5 }, yoyo: true, repeat: -1, duration: 900 });
    this.shockGfx = ctx.scene.add.graphics().setDepth(8);
  }

  onDeath(): void {
    this.shockGfx?.destroy();
    this.shockGfx = undefined;
    this.pending.length = 0;
    this.shockwaves.length = 0;
  }

  private get tempo() {
    return TEMPO[this.phase];
  }

  private windupMult(e: Enemy): number {
    return this.tempo.windup * (this.enraged ? e.def.params.enrageWindup : 1);
  }

  update(e: Enemy, dt: number, ctx: RunContext): void {
    const p = e.def.params;
    this.timer -= dt;
    this.summonCd -= dt;
    this.fightTime += dt;
    this.updatePending(e, dt, ctx);
    this.updateShockwaves(e, dt, ctx);

    // Soft DPS check: a long fight makes the boss hit harder and faster.
    if (!this.enraged && this.fightTime >= p.enrageTime) this.enrage(e, ctx);

    // Phase transitions (never mid-charge, never while stunned).
    if (this.state !== 'charging' && this.state !== 'stunned' && this.state !== 'transition') {
      if (this.phase === 1 && e.hpRatio <= p.phase2At) return this.enterPhase(e, ctx, 2);
      if (this.phase === 2 && e.hpRatio <= p.phase3At) return this.enterPhase(e, ctx, 3);
    }

    // Uninterruptible while charging, mid-combo or transitioning.
    const committed = this.state === 'charging' || this.state === 'transition' || this.state === 'quake'
      || (this.state === 'windup' && (this.attack === 'comboBite' || this.attack === 'charge'));
    e.ccResist = committed ? 1 : p.ccResist;

    this.trackBehind(e, dt, ctx);

    switch (this.state) {
      case 'walk':
        e.moveToward(ctx.player.x, ctx.player.y, this.tempo.speed, dt, ctx);
        if (this.phase >= 2 && this.behindTime >= p.tailBehindTime) this.beginAttack(e, ctx, 'tailSweep');
        else if (this.timer <= 0) this.chooseAttack(e, ctx);
        break;
      case 'windup':
        e.faceTowards(this.angle, dt, 6);
        if (this.attack === 'charge') e.sprite.x += (Math.random() - 0.5) * 5;
        if (this.timer <= 0) this.executeAttack(e, ctx);
        break;
      case 'charging':
        e.moveAngle(this.angle, p.chargeSpeed * (this.phase >= 2 ? 1.1 : 1), dt, ctx);
        ctx.fx.dust(e.x, e.y, 2);
        if (this.timer <= 0) this.endCharge(e, ctx);
        break;
      case 'quake':
        e.sprite.x += (Math.random() - 0.5) * 4;
        this.quakeTick -= dt;
        if (this.quakeTick <= 0) {
          this.quakeTick = p.quakeInterval;
          this.dropRock(e, ctx);
        }
        if (this.timer <= 0) this.toRecover(0.8);
        break;
      case 'transition':
        e.sprite.x += (Math.random() - 0.5) * 6;
        if (this.timer <= 0) this.toRecover(0.6);
        break;
      case 'stunned':
        if (Math.random() < 0.15) ctx.fx.dust(e.x, e.y - e.radius * 0.5, 2);
        if (this.timer <= 0) {
          e.damageTakenMult = 1;
          e.setBaseTint(this.phaseTint);
          this.toRecover(0.4);
        }
        break;
      case 'recover':
        e.moveToward(ctx.player.x, ctx.player.y, 0.4 * this.tempo.speed, dt, ctx);
        if (this.timer <= 0) {
          this.state = 'walk';
          this.timer = p.attackCooldown * this.tempo.cooldown;
        }
        break;
    }
  }

  onBlocked(e: Enemy, ctx: RunContext): void {
    if (this.state !== 'charging') return;
    // Ran into a rock or wall: the punish window.
    const p = e.def.params;
    e.attackContactDamage = 0;
    e.ignoreSeparation = false;
    this.chargesLeft = 0;
    this.state = 'stunned';
    this.timer = p.stunTime;
    e.damageTakenMult = p.vulnerableMult;
    e.setBaseTint(0xfff0a0);
    slamFx(ctx, e.x, e.y, 150, 0xffd060);
    ctx.fx.shake(0.016, 300);
    ctx.hitstop(0.08);
    ctx.fx.floatText(e.x, e.y - e.radius - 20, 'ATORDOADO! +50% DANO', '#ffe070', 22);
  }

  // ─────────────────────────── phases ───────────────────────────

  private get phaseTint(): number | null {
    return this.phase === 3 ? 0xff5040 : this.phase === 2 ? 0xff7060 : null;
  }

  private enterPhase(e: Enemy, ctx: RunContext, phase: Phase): void {
    const p = e.def.params;
    this.phase = phase;
    this.state = 'transition';
    this.timer = 1.4;
    this.bitesLeft = 0;
    this.chargesLeft = 0;
    this.summonCd = Math.min(this.summonCd, 3);
    e.attackContactDamage = 0;
    e.ignoreSeparation = false;
    e.damageTakenMult = 1;
    e.setBaseTint(this.phaseTint);
    if (phase === 2) {
      this.aura?.setTint(0xff1010);
      ctx.bus.emit('banner', { text: 'FÚRIA DO GIGANOTOSAURUS', sub: 'Investidas em sequência — não fique atrás dele', color: 0xff3020 });
    } else {
      this.aura?.setTint(0xff0000).setScale(e.radius / 11);
      ctx.bus.emit('banner', { text: 'PREDADOR SUPREMO', sub: 'O chão se parte — atravesse as ondas de choque', color: 0xff1010 });
    }
    resolveCircle(ctx, e, e.x, e.y, p.roarRadius, p.roarDamage, p.roarForce, false);
    ctx.fx.ring(e.x, e.y, p.roarRadius * 1.4, 0xff4020, 700);
    ctx.fx.shake(0.015, 500);
    ctx.hitstop(0.12);
  }

  private enrage(e: Enemy, ctx: RunContext): void {
    this.enraged = true;
    e.damageMult *= e.def.params.enrageDamage;
    this.aura?.setTint(0xff0040).setScale(e.radius / 10);
    ctx.bus.emit('banner', { text: 'O GIGANOTOSAURUS ENLOUQUECE', sub: 'Acabe com ele rápido!', color: 0xff1030 });
    ctx.fx.ring(e.x, e.y, 420, 0xff0040, 700);
    ctx.fx.shake(0.012, 600);
  }

  /** Accumulates time while the player stands behind the boss, within tail reach. */
  private trackBehind(e: Enemy, dt: number, ctx: RunContext): void {
    const p = e.def.params;
    const behind = Math.abs(angleDiff(e.facing, e.angleToPlayer(ctx))) > 2.1;
    const close = e.distToPlayer(ctx) < p.tailRadius + ctx.player.radius;
    this.behindTime = behind && close ? this.behindTime + dt : Math.max(0, this.behindTime - dt * 2);
  }

  // ─────────────────────────── attacks ───────────────────────────

  private chooseAttack(e: Enemy, ctx: RunContext): void {
    const p = e.def.params;
    const dist = e.distToPlayer(ctx);
    const close = dist < p.biteRange + ctx.player.radius;
    const ph = this.phase;
    const options: { a: Attack; w: number }[] = [
      { a: 'bite', w: close ? 3 : 0 },
      { a: 'comboBite', w: close ? (ph === 1 ? 2 : 3) : 0 },
      { a: 'roar', w: close ? 2 : 0.5 },
      { a: 'stomp', w: 3 },
      { a: 'charge', w: close ? 1 : 5 },
      { a: 'summon', w: this.summonCd <= 0 ? 3 : 0 },
      { a: 'quake', w: ph === 3 ? 2.5 : 0 },
    ];
    const pick = weightedPick(options.filter((o) => o.a !== this.last), (o) => o.w) ?? options[3];
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
        e.trackTelegraph(T.cone(e.x, e.y, this.angle, this.biteArc(e), p.biteRange, this.timer));
        break;
      case 'comboBite':
        this.bitesLeft = this.phase === 3 ? 3 : 2;
        this.aimComboBite(e, ctx);
        break;
      case 'charge':
        this.chargesLeft = this.phase >= 2 ? p.chargeChain : 1;
        this.aimCharge(e, ctx, p.chargeWindup * wm);
        break;
      case 'roar':
        this.timer = p.roarWindup * wm;
        e.trackTelegraph(T.circle(e.x, e.y, p.roarRadius, this.timer, 0xff8a2a));
        break;
      case 'stomp':
        this.timer = p.stompWindup * wm;
        if (this.phase === 3) {
          // Shockwaves radiate from the boss: the warning marks their origin.
          e.trackTelegraph(T.circle(e.x, e.y, e.radius * 1.8, this.timer, 0xff6030));
        } else {
          this.telegraphStomps(e, ctx);
        }
        break;
      case 'summon':
        this.timer = 0.8;
        this.summonCd = this.tempo.summonCd;
        e.trackTelegraph(T.circle(e.x, e.y, e.radius * 1.6, this.timer, 0xb070ff));
        break;
      case 'tailSweep':
        this.behindTime = 0;
        this.timer = p.tailWindup * wm;
        e.trackTelegraph(T.circle(e.x, e.y, p.tailRadius, this.timer, 0xffb040));
        break;
      case 'quake':
        this.timer = 0.9;
        e.trackTelegraph(T.circle(e.x, e.y, e.radius * 2, this.timer, 0xc07030));
        ctx.fx.shake(0.004, 900);
        break;
    }
  }

  private biteArc(e: Enemy): number {
    return e.def.params.biteArc * (this.phase >= 2 ? 1.25 : 1);
  }

  private aimComboBite(e: Enemy, ctx: RunContext): void {
    const p = e.def.params;
    this.state = 'windup';
    this.angle = e.angleToPlayer(ctx);
    this.timer = p.comboWindup * this.windupMult(e);
    e.trackTelegraph(ctx.telegraphs.cone(e.x, e.y, this.angle, this.biteArc(e), p.biteRange, this.timer, 0xff2040));
  }

  private aimCharge(e: Enemy, ctx: RunContext, windup: number): void {
    const p = e.def.params;
    this.state = 'windup';
    this.attack = 'charge';
    this.angle = e.angleToPlayer(ctx);
    this.timer = windup;
    e.trackTelegraph(ctx.telegraphs.line(e.x, e.y, this.angle, p.chargeSpeed * p.chargeTime * 1.05, e.radius * 2, this.timer));
  }

  private telegraphStomps(e: Enemy, ctx: RunContext): void {
    const p = e.def.params;
    const n = p.stompCount + (this.phase === 2 ? 2 : 0);
    const r = p.stompRadius * (this.phase === 2 ? 1.2 : 1);
    this.stompSpots = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = i === 0 ? 0 : 80 + Math.random() * 160;
      const x = ctx.player.x + ctx.player.vx * 0.4 + Math.cos(a) * d;
      const y = ctx.player.y + ctx.player.vy * 0.4 + Math.sin(a) * d;
      this.stompSpots.push({ x, y });
      e.trackTelegraph(ctx.telegraphs.circle(x, y, r, this.timer));
    }
  }

  private executeAttack(e: Enemy, ctx: RunContext): void {
    const p = e.def.params;
    switch (this.attack) {
      case 'bite':
      case 'comboBite':
        resolveCone(ctx, e, this.angle, this.biteArc(e), p.biteRange, p.biteDamage, 600);
        ctx.fx.bite(e.x + Math.cos(this.angle) * p.biteRange * 0.7, e.y + Math.sin(this.angle) * p.biteRange * 0.7, this.angle, 2.4, false);
        ctx.fx.shake(0.008, 160);
        if (this.attack === 'comboBite' && --this.bitesLeft > 0) {
          this.aimComboBite(e, ctx);
          return;
        }
        break;
      case 'charge':
        this.chargesLeft--;
        this.state = 'charging';
        this.timer = p.chargeTime;
        e.attackContactDamage = p.chargeDamage;
        e.ignoreSeparation = true;
        return;
      case 'roar': {
        const hit = resolveCircle(ctx, e, e.x, e.y, p.roarRadius, p.roarDamage, p.roarForce, false);
        if (hit && this.phase >= 2) {
          ctx.status.apply(ctx.player, 'slow', { duration: p.roarSlow, source: 'enemy' });
          ctx.fx.floatText(ctx.player.x, ctx.player.y - 40, 'LENTO!', '#a0d0ff', 18);
        }
        ctx.fx.ring(e.x, e.y, p.roarRadius, 0xff8a2a, 500);
        ctx.fx.ring(e.x, e.y, p.roarRadius * 0.7, 0xffd060, 400);
        ctx.fx.shake(0.012, 350);
        break;
      }
      case 'stomp':
        if (this.phase === 3) {
          for (let i = 0; i < p.shockCount; i++) this.shockwaves.push({ x: e.x, y: e.y, r: e.radius, delay: i * p.shockGap, hit: false });
          slamFx(ctx, e.x, e.y, e.radius * 1.8, 0xff6030);
        } else {
          const r = p.stompRadius * (this.phase === 2 ? 1.2 : 1);
          let hit = false;
          for (const s of this.stompSpots) {
            if (!hit) hit = resolveCircle(ctx, e, s.x, s.y, r, p.stompDamage, 380);
            slamFx(ctx, s.x, s.y, r, 0xff6030);
          }
        }
        break;
      case 'summon':
        this.summon(e, ctx);
        break;
      case 'tailSweep':
        resolveCircle(ctx, e, e.x, e.y, p.tailRadius, p.tailDamage, 700);
        ctx.fx.swipe(e.x, e.y, e.facing + Math.PI, p.tailRadius, Math.PI * 2, 0xffc080);
        ctx.fx.dust(e.x, e.y, 16);
        ctx.fx.shake(0.01, 220);
        break;
      case 'quake':
        this.state = 'quake';
        this.timer = p.quakeDuration;
        this.quakeTick = 0;
        ctx.fx.shake(0.006, p.quakeDuration * 1000);
        return;
    }
    this.toRecover(0.7);
  }

  private summon(e: Enemy, ctx: RunContext): void {
    const p = e.def.params;
    if (this.phase === 3) {
      ctx.spawner.spawnAround('carnotaurus', e.x, e.y, 1, e.radius + 110);
      ctx.spawner.spawnAround('compy', e.x, e.y, 6, e.radius + 60);
    } else {
      ctx.spawner.spawnAround('compy', e.x, e.y, p.summonCount + (this.phase === 2 ? 4 : 0), e.radius + 60);
      ctx.spawner.spawnAround('wildRaptor', e.x, e.y, this.phase === 2 ? 3 : 2, e.radius + 90);
      if (this.phase === 2) ctx.spawner.spawnAround('dilophosaurus', e.x, e.y, 2, e.radius + 120);
    }
    ctx.fx.ring(e.x, e.y, 260, 0xb070ff, 500);
  }

  private endCharge(e: Enemy, ctx: RunContext): void {
    e.attackContactDamage = 0;
    e.ignoreSeparation = false;
    slamFx(ctx, e.x, e.y, 130, 0xff6030);
    resolveCircle(ctx, e, e.x, e.y, 130, 18, 400);
    if (this.chargesLeft > 0) {
      this.aimCharge(e, ctx, e.def.params.chargeReaim * this.windupMult(e));
      return;
    }
    this.toRecover(0.9);
  }

  private toRecover(seconds: number): void {
    this.state = 'recover';
    this.timer = seconds;
  }

  // ─────────────────────────── phase 3 hazards ───────────────────────────

  /** One falling rock near the player (the first of every few lands right on them). */
  private dropRock(e: Enemy, ctx: RunContext): void {
    const p = e.def.params;
    const pl = ctx.player;
    const onPlayer = Math.random() < 0.35;
    const a = Math.random() * Math.PI * 2;
    const d = onPlayer ? 0 : 60 + Math.random() * 220;
    const x = pl.x + pl.vx * 0.5 + Math.cos(a) * d;
    const y = pl.y + pl.vy * 0.5 + Math.sin(a) * d;
    const t = p.quakeWindup * this.windupMult(e);
    e.trackTelegraph(ctx.telegraphs.circle(x, y, p.quakeRadius, t, 0xc07030));
    this.pending.push({ x, y, r: p.quakeRadius, damage: p.quakeDamage, t });
  }

  private updatePending(e: Enemy, dt: number, ctx: RunContext): void {
    if (!this.pending.length) return;
    for (const h of this.pending) {
      h.t -= dt;
      if (h.t > 0) continue;
      resolveCircle(ctx, e, h.x, h.y, h.r, h.damage, 300);
      ctx.fx.explosion(h.x, h.y, h.r, 0xa07040, 'dust');
    }
    this.pending = this.pending.filter((h) => h.t > 0);
  }

  /** Expanding rings: only the ring's edge hurts, so they're crossed (or dashed through), not outrun. */
  private updateShockwaves(e: Enemy, dt: number, ctx: RunContext): void {
    const g = this.shockGfx;
    if (!g) return;
    g.clear();
    if (!this.shockwaves.length) return;
    const p = e.def.params;
    const pl = ctx.player;
    for (const s of this.shockwaves) {
      if (s.delay > 0) {
        s.delay -= dt;
        continue;
      }
      s.r += p.shockSpeed * dt;
      const d = Math.hypot(pl.x - s.x, pl.y - s.y);
      if (!s.hit && Math.abs(d - s.r) < p.shockWidth / 2 + pl.radius * 0.6) {
        s.hit = true;
        ctx.damage.hitPlayer({
          amount: p.stompDamage * e.damageMult,
          attacker: e,
          tags: ['aoe'],
          knockAngle: Math.atan2(pl.y - s.y, pl.x - s.x),
          knockForce: 420,
          pierce: p.pierce,
        });
      }
      const fade = 1 - s.r / p.shockMaxRadius;
      g.lineStyle(p.shockWidth, 0xff6030, 0.25 + 0.35 * fade);
      g.strokeCircle(s.x, s.y, s.r);
      g.lineStyle(4, 0xffd0a0, 0.5 + 0.5 * fade);
      g.strokeCircle(s.x, s.y, s.r);
    }
    this.shockwaves = this.shockwaves.filter((s) => s.r < p.shockMaxRadius);
  }
}
