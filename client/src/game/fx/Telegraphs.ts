import Phaser from 'phaser';

export interface TelegraphHandle {
  cancel(): void;
  readonly done: boolean;
}

type Shape =
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'cone'; x: number; y: number; angle: number; arc: number; range: number }
  | { kind: 'line'; x: number; y: number; angle: number; length: number; width: number };

class Telegraph implements TelegraphHandle {
  elapsed = 0;
  done = false;
  constructor(
    readonly g: Phaser.GameObjects.Graphics,
    readonly shape: Shape,
    readonly duration: number,
    readonly color: number,
  ) {}

  cancel(): void {
    if (this.done) return;
    this.done = true;
    this.g.destroy();
  }

  draw(): void {
    const g = this.g;
    const t = Math.min(1, this.elapsed / this.duration);
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 22);
    g.clear();
    const s = this.shape;
    const edgeAlpha = 0.55 + pulse * 0.35;
    if (s.kind === 'circle') {
      g.fillStyle(this.color, 0.12);
      g.fillCircle(s.x, s.y, s.r);
      g.fillStyle(this.color, 0.32);
      g.fillCircle(s.x, s.y, s.r * t);
      g.lineStyle(3, this.color, edgeAlpha);
      g.strokeCircle(s.x, s.y, s.r);
    } else if (s.kind === 'cone') {
      const a0 = s.angle - s.arc / 2;
      const a1 = s.angle + s.arc / 2;
      g.fillStyle(this.color, 0.12);
      g.slice(s.x, s.y, s.range, a0, a1, false);
      g.fillPath();
      g.fillStyle(this.color, 0.32);
      g.slice(s.x, s.y, s.range * t, a0, a1, false);
      g.fillPath();
      g.lineStyle(3, this.color, edgeAlpha);
      g.slice(s.x, s.y, s.range, a0, a1, false);
      g.strokePath();
    } else {
      const cos = Math.cos(s.angle);
      const sin = Math.sin(s.angle);
      const nx = -sin * s.width / 2;
      const ny = cos * s.width / 2;
      const ex = s.x + cos * s.length;
      const ey = s.y + sin * s.length;
      const px = s.x + cos * s.length * t;
      const py = s.y + sin * s.length * t;
      g.fillStyle(this.color, 0.12);
      g.fillPoints([
        { x: s.x + nx, y: s.y + ny }, { x: ex + nx, y: ey + ny },
        { x: ex - nx, y: ey - ny }, { x: s.x - nx, y: s.y - ny },
      ], true);
      g.fillStyle(this.color, 0.3);
      g.fillPoints([
        { x: s.x + nx, y: s.y + ny }, { x: px + nx, y: py + ny },
        { x: px - nx, y: py - ny }, { x: s.x - nx, y: s.y - ny },
      ], true);
      g.lineStyle(3, this.color, edgeAlpha);
      g.strokePoints([
        { x: s.x + nx, y: s.y + ny }, { x: ex + nx, y: ey + ny },
        { x: ex - nx, y: ey - ny }, { x: s.x - nx, y: s.y - ny },
      ], true);
      // arrow head
      g.fillStyle(this.color, edgeAlpha);
      g.fillTriangle(ex + cos * 16, ey + sin * 16, ex + nx * 0.8, ey + ny * 0.8, ex - nx * 0.8, ey - ny * 0.8);
    }
  }
}

/**
 * Visual warnings for dangerous enemy attacks. Driven by the run's simulation
 * clock, so they freeze with the game during pauses and level-ups.
 */
export class Telegraphs {
  private list: Telegraph[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  private add(shape: Shape, duration: number, color: number): TelegraphHandle {
    const g = this.scene.add.graphics().setDepth(8);
    const t = new Telegraph(g, shape, duration, color);
    t.draw();
    this.list.push(t);
    return t;
  }

  circle(x: number, y: number, r: number, duration: number, color = 0xff3a2a): TelegraphHandle {
    return this.add({ kind: 'circle', x, y, r }, duration, color);
  }

  cone(x: number, y: number, angle: number, arc: number, range: number, duration: number, color = 0xff3a2a): TelegraphHandle {
    return this.add({ kind: 'cone', x, y, angle, arc, range }, duration, color);
  }

  line(x: number, y: number, angle: number, length: number, width: number, duration: number, color = 0xff3a2a): TelegraphHandle {
    return this.add({ kind: 'line', x, y, angle, length, width }, duration, color);
  }

  update(dt: number): void {
    for (const t of this.list) {
      if (t.done) continue;
      t.elapsed += dt;
      if (t.elapsed >= t.duration) t.cancel();
      else t.draw();
    }
    this.list = this.list.filter((t) => !t.done);
  }

  clear(): void {
    for (const t of this.list) t.cancel();
    this.list = [];
  }
}
