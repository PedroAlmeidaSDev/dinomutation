import Phaser from 'phaser';
import { ARENA_DECOR_COUNT, ARENA_OBSTACLES } from '../../data/arena';
import { BALANCE } from '../../data/balance';
import type { DifficultyId } from '../../data/difficulty';
import type { DinoId } from '../../data/dinosaurs';
import { DEBUG } from '../config';
import { Run } from '../core/Run';
import { prefersTouch } from '../ui/TouchControls';
import type { HUDScene } from './HUDScene';

export interface RunSceneData {
  dino: DinoId;
  difficulty?: DifficultyId;
}

/**
 * Hosts a Run: arena rendering, input, camera, pause / level-up flow,
 * hit-stop and end-of-run transitions.
 */
export class RunScene extends Phaser.Scene {
  run!: Run;
  private hud: HUDScene | null = null;
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', Phaser.Input.Keyboard.Key>;
  private paused = false;
  private selecting = false;
  /** Story boss is dead: waiting to show / showing the "end or go endless" choice. */
  private victoryPending = false;
  private choosingEndless = false;
  private selectionClosedAt = 0;
  private rerolls: number = BALANCE.upgrades.rerollsPerRun;
  private endTimer = -1;
  private timeScale = 1;
  private dino: DinoId = 'trex';
  private difficulty: DifficultyId = 'normal';

  constructor() {
    super('Run');
  }

  create(data: RunSceneData): void {
    this.dino = data.dino ?? 'trex';
    this.difficulty = data.difficulty ?? 'normal';
    this.paused = false;
    this.selecting = false;
    this.victoryPending = false;
    this.choosingEndless = false;
    this.hud = null;
    this.endTimer = -1;
    this.timeScale = 1;
    this.rerolls = BALANCE.upgrades.rerollsPerRun;

    this.buildArena();
    this.run = new Run(this, this.dino, this.difficulty);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, BALANCE.world.width, BALANCE.world.height);
    cam.startFollow(this.run.player.root, true, 0.12, 0.12);
    cam.setBackgroundColor(0x1a1f14);
    cam.fadeIn(400);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as RunScene['keys'];
    kb.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');
    kb.on('keydown-SPACE', () => this.useAbility());
    kb.on('keydown-ESC', () => this.togglePause());
    if (DEBUG) this.setupDebug(kb);

    this.run.bus.on('banner', (b) => this.hud?.hud.banner(b.text, b.sub, b.color));
    this.run.bus.on('onLevelUp', () => this.run.fx.levelUp(this.run.player.x, this.run.player.y));
    this.run.bus.on('storyBossDefeated', () => {
      this.victoryPending = true;
      // Let the boss explosion play before asking.
      this.time.delayedCall(1600, () => this.offerEndless());
    });

    this.scene.launch('HUD', { runScene: this });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.run.destroy();
      this.input.keyboard?.removeAllListeners();
    });

    const hint = prefersTouch()
      ? 'Arraste o dedo para mover · Botão à direita: habilidade'
      : 'WASD para mover · SPACE habilidade · ESC pausa';
    this.time.delayedCall(600, () => this.run.bus.emit('banner', { text: 'SOBREVIVA E EVOLUA', sub: hint, color: 0xffe0a0 }));
  }

  attachHud(hud: HUDScene): void {
    this.hud = hud;
  }

  private get simPaused(): boolean {
    return this.paused || this.selecting || this.choosingEndless;
  }

  /** True while gameplay input should be ignored (paused, picking an upgrade, run over). */
  get inputBlocked(): boolean {
    return this.simPaused || !!this.run.outcome;
  }

  useAbility(): void {
    if (!this.simPaused) this.run.abilities.tryActivate();
  }

  private setSimFrozen(frozen: boolean): void {
    if (frozen) {
      this.tweens.pauseAll();
      this.run.fx.pause();
      this.time.paused = true;
    } else {
      this.tweens.resumeAll();
      this.run.fx.resume();
      this.time.paused = false;
    }
  }

  togglePause(): void {
    if (this.selecting || this.victoryPending || this.run.outcome || !this.hud) return;
    this.paused = !this.paused;
    this.setSimFrozen(this.paused);
    if (this.paused) this.hud.showPause(() => this.togglePause(), () => this.quitToMenu());
    else this.hud.hidePause();
  }

  private quitToMenu(): void {
    this.scene.stop('HUD');
    this.scene.start('Menu');
  }

  update(_time: number, deltaMs: number): void {
    const realDt = Math.min(deltaMs, 50) / 1000;
    if (this.simPaused) return;

    if (this.run.outcome) this.updateEnding(realDt);

    if (this.run.hitstopTimer > 0) {
      this.run.hitstopTimer -= realDt;
      return;
    }

    let ix = 0;
    let iy = 0;
    const k = this.keys;
    if (k.A.isDown || k.LEFT.isDown) ix -= 1;
    if (k.D.isDown || k.RIGHT.isDown) ix += 1;
    if (k.W.isDown || k.UP.isDown) iy -= 1;
    if (k.S.isDown || k.DOWN.isDown) iy += 1;
    const touch = this.hud?.touch;
    if (touch) {
      ix += touch.x;
      iy += touch.y;
    }

    this.run.update(realDt * this.timeScale, ix, iy);

    if (!this.run.outcome && !this.victoryPending && this.run.xp.hasPending && this.hud && this.run.player.isAlive()) this.openSelection();
  }

  /** Story boss down: end the run as a victory, or continue into the endless mode. */
  private offerEndless(): void {
    if (this.run.outcome || !this.hud) return;
    this.choosingEndless = true;
    this.setSimFrozen(true);
    this.hud.showVictoryChoice(
      () => {
        this.choosingEndless = false;
        this.victoryPending = false;
        this.setSimFrozen(false);
        this.run.director.startEndless();
        this.run.xp.pendingLegendary++;
      },
      () => {
        this.choosingEndless = false;
        this.setSimFrozen(false);
        this.run.outcome = 'victory';
      },
    );
  }

  private openSelection(): void {
    const run = this.run;
    const hud = this.hud!;
    const legendary = run.xp.pendingLegendary > 0;
    const rare = !legendary && run.xp.pendingRare > 0;
    this.selecting = true;
    this.setSimFrozen(true);
    const choices = run.upgrades.roll({ minRarity: legendary ? 'legendary' : rare ? 'rare' : 'common' });
    const buildTags = new Set(run.upgrades.buildTagCounts(false).keys());
    hud.showSelection({
      title: legendary ? 'MUTAÇÃO LENDÁRIA!' : rare ? 'MUTAGÊNICO RARO!' : `EVOLUÇÃO! NÍVEL ${run.xp.level - run.xp.pendingLevelUps + 1}`,
      subtitle: legendary
        ? `Recompensa da Era Sem Fim — Era ${run.run.era}`
        : rare ? 'A elite deixou um DNA poderoso — escolha uma mutação rara' : 'Escolha uma mutação',
      choices,
      buildTags,
      rerolls: this.rerolls,
      onPick: (choice) => {
        run.upgrades.acquire(choice.def.id);
        if (legendary) run.xp.pendingLegendary--;
        else if (rare) run.xp.pendingRare--;
        else run.xp.pendingLevelUps--;
        run.fx.ring(run.player.x, run.player.y, 120, 0xffe070, 400);
        this.selecting = false;
        this.selectionClosedAt = this.time.now;
        this.setSimFrozen(false);
      },
      onReroll: () => {
        this.rerolls--;
        this.selecting = false;
        this.setSimFrozen(false);
        this.openSelection();
      },
    });
  }

  private updateEnding(realDt: number): void {
    if (this.endTimer < 0) {
      this.endTimer = this.run.outcome === 'victory' ? 3.2 : 2.0;
      if (this.run.outcome === 'defeat') {
        const p = this.run.player;
        this.run.fx.explosion(p.x, p.y, 120, 0xff2020, 'blood');
        this.tweens.add({ targets: p.root, alpha: 0.25, angle: 90, duration: 800 });
        this.cameras.main.zoomTo(1.25, 1200);
      } else {
        this.cameras.main.flash(400, 255, 240, 200);
      }
    }
    this.timeScale = Math.max(0.25, this.timeScale - realDt * 1.5);
    this.endTimer -= realDt;
    if (this.endTimer <= 0) {
      this.endTimer = 999;
      const state = this.run.run;
      this.cameras.main.fadeOut(500);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.stop('HUD');
        this.scene.start(this.run.outcome === 'victory' ? 'Victory' : 'GameOver', { state });
      });
    }
  }

  private setupDebug(kb: Phaser.Input.Keyboard.KeyboardPlugin): void {
    const guard = (fn: () => void) => () => {
      if (this.simPaused || this.time.now - this.selectionClosedAt < 400) return;
      fn();
    };
    kb.on('keydown-ONE', guard(() => this.run.debugLevelUp()));
    kb.on('keydown-TWO', guard(() => {
      this.run.damage.invincible = !this.run.damage.invincible;
      this.run.fx.floatText(this.run.player.x, this.run.player.y - 50, this.run.damage.invincible ? 'INVENCÍVEL' : 'MORTAL', '#8aff8a');
    }));
    kb.on('keydown-THREE', guard(() => { this.run.director.eliteSpawned = false; this.run.director.spawnElite(); }));
    kb.on('keydown-FOUR', guard(() => this.run.director.spawnBoss()));
    kb.on('keydown-FIVE', guard(() => this.run.debugKillAll()));
    kb.on('keydown-SIX', guard(() => this.run.director.skip(60)));
  }

  private buildArena(): void {
    const W = BALANCE.world.width;
    const H = BALANCE.world.height;
    const T = BALANCE.world.wallThickness;
    this.add.tileSprite(0, 0, W, H, 'ground').setOrigin(0).setDepth(0);

    // Seeded decor so the arena always looks the same.
    let seed = 1337;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const decor = ['decor_grass', 'decor_grass', 'decor_pebble', 'decor_fern'];
    for (let i = 0; i < ARENA_DECOR_COUNT; i++) {
      this.add.image(T + rnd() * (W - 2 * T), T + rnd() * (H - 2 * T), decor[Math.floor(rnd() * decor.length)])
        .setDepth(1).setAlpha(0.75).setRotation(rnd() * 0.6 - 0.3).setScale(0.8 + rnd() * 0.8);
    }

    // Border cliffs
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x151a10, 1);
    g.fillRect(0, 0, W, T);
    g.fillRect(0, H - T, W, T);
    g.fillRect(0, 0, T, H);
    g.fillRect(W - T, 0, T, H);
    g.lineStyle(6, 0x2a3220, 1);
    g.strokeRect(T, T, W - 2 * T, H - 2 * T);
    for (let x = 0; x < W; x += 90) {
      this.add.image(x + rnd() * 30, T * 0.5, 'obs_rock').setDepth(3).setScale(0.9 + rnd() * 0.5);
      this.add.image(x + rnd() * 30, H - T * 0.5, 'obs_rock').setDepth(3).setScale(0.9 + rnd() * 0.5);
    }
    for (let y = 0; y < H; y += 90) {
      this.add.image(T * 0.5, y + rnd() * 30, 'obs_rock').setDepth(3).setScale(0.9 + rnd() * 0.5);
      this.add.image(W - T * 0.5, y + rnd() * 30, 'obs_rock').setDepth(3).setScale(0.9 + rnd() * 0.5);
    }

    for (const o of ARENA_OBSTACLES) {
      switch (o.type) {
        case 'rock':
        case 'bigRock':
          this.add.image(o.x, o.y, 'obs_rock').setDepth(10).setScale((o.r * 2.3) / 80).setRotation(rnd() * 6);
          break;
        case 'tree':
          this.add.image(o.x, o.y, 'obs_trunk').setDepth(10).setScale(o.r / 18);
          this.add.image(o.x, o.y - 10, 'obs_canopy').setDepth(85).setScale((o.r * 4.4) / 140).setAlpha(0.88).setRotation(rnd() * 6);
          break;
        case 'bones':
          this.add.image(o.x, o.y, 'obs_bones').setDepth(10).setScale((o.r * 2.8) / 70).setRotation(rnd() * 6);
          break;
        case 'skull':
          this.add.image(o.x, o.y, 'obs_skull').setDepth(10).setScale((o.r * 2.5) / 70).setRotation(rnd() * 6);
          break;
      }
    }
  }
}
