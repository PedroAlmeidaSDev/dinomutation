import Phaser from 'phaser';

/**
 * All art is generated at boot from simple shapes — no external assets.
 * Creatures are drawn top-down, facing right (angle 0).
 */

type G = Phaser.GameObjects.Graphics;

function makeTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function makeCanvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  draw(tex.getContext());
  tex.refresh();
}

function tail(g: G, fromX: number, cy: number, toX: number, width: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillTriangle(fromX, cy - width / 2, fromX, cy + width / 2, toX, cy);
}

function eyes(g: G, x: number, cy: number, spread: number, r = 2): void {
  g.fillStyle(0xfff2c0, 1);
  g.fillCircle(x, cy - spread, r + 0.8);
  g.fillCircle(x, cy + spread, r + 0.8);
  g.fillStyle(0x100800, 1);
  g.fillCircle(x + 0.6, cy - spread, r * 0.6);
  g.fillCircle(x + 0.6, cy + spread, r * 0.6);
}

function stripes(g: G, x0: number, x1: number, cy: number, h: number, color: number, n: number): void {
  g.fillStyle(color, 0.55);
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
    g.fillEllipse(x, cy, 3, h);
  }
}

function drawCreatures(scene: Phaser.Scene): void {
  // ── T-REX (player) ──
  makeTex(scene, 'dino_trex', 100, 64, (g) => {
    const cy = 32;
    tail(g, 40, cy, 2, 18, 0x6e5c32);
    g.fillStyle(0x5a4a28, 1);
    g.fillEllipse(44, cy - 17, 18, 10);
    g.fillEllipse(44, cy + 17, 18, 10);
    g.fillStyle(0x8a7440, 1);
    g.fillEllipse(48, cy, 46, 32);
    g.fillStyle(0xb0985a, 1);
    g.fillEllipse(52, cy, 26, 14);
    stripes(g, 34, 60, cy, 26, 0x4a3a1a, 4);
    g.fillStyle(0x5a4a28, 1);
    g.fillEllipse(64, cy - 10, 8, 5);
    g.fillEllipse(64, cy + 10, 8, 5);
    g.fillStyle(0x8a7440, 1);
    g.fillEllipse(78, cy, 34, 26);
    g.fillStyle(0x9a8450, 1);
    g.fillEllipse(88, cy, 20, 18);
    g.fillStyle(0x3a2a10, 1);
    g.fillRect(84, cy - 1, 14, 2);
    eyes(g, 76, cy, 8, 2.4);
  });

  // ── VELOCIRAPTOR (player) ──
  makeTex(scene, 'dino_raptor', 84, 40, (g) => {
    const cy = 20;
    tail(g, 32, cy, 0, 10, 0xa86a30);
    g.fillStyle(0x7a4420, 1);
    g.fillEllipse(36, cy - 10, 12, 6);
    g.fillEllipse(36, cy + 10, 12, 6);
    g.fillStyle(0xc47a3a, 1);
    g.fillEllipse(40, cy, 32, 18);
    stripes(g, 28, 50, cy, 16, 0x5a2a10, 4);
    g.fillStyle(0xf0d0a0, 1);
    g.fillTriangle(48, cy - 9, 54, cy - 12, 52, cy - 6);
    g.fillTriangle(48, cy + 9, 54, cy + 12, 52, cy + 6);
    g.fillStyle(0xc47a3a, 1);
    g.fillEllipse(62, cy, 24, 13);
    g.fillStyle(0xd48a4a, 1);
    g.fillEllipse(72, cy, 14, 9);
    eyes(g, 62, cy, 4.5, 1.8);
  });

  // ── TRICERATOPS (player) ──
  makeTex(scene, 'dino_tri', 104, 72, (g) => {
    const cy = 36;
    tail(g, 34, cy, 4, 18, 0x4d6a8a);
    g.fillStyle(0x3d5570, 1);
    g.fillEllipse(34, cy - 22, 18, 12);
    g.fillEllipse(34, cy + 22, 18, 12);
    g.fillEllipse(62, cy - 21, 16, 11);
    g.fillEllipse(62, cy + 21, 16, 11);
    g.fillStyle(0x5f7fa3, 1);
    g.fillEllipse(48, cy, 54, 42);
    stripes(g, 30, 64, cy, 34, 0x3d5570, 5);
    // frill
    g.fillStyle(0xd0a060, 1);
    g.fillEllipse(72, cy, 16, 50);
    g.fillStyle(0xa07030, 1);
    for (let i = -2; i <= 2; i++) g.fillCircle(68, cy + i * 10, 2.4);
    g.fillStyle(0x6f8fb3, 1);
    g.fillEllipse(84, cy, 26, 24);
    // horns
    g.fillStyle(0xf0e0c0, 1);
    g.fillTriangle(84, cy - 9, 88, cy - 5, 102, cy - 12);
    g.fillTriangle(84, cy + 9, 88, cy + 5, 102, cy + 12);
    g.fillTriangle(94, cy - 3, 94, cy + 3, 102, cy);
    eyes(g, 82, cy, 7, 2);
  });

  // ── Enemies ──
  makeTex(scene, 'en_compy', 30, 18, (g) => {
    const cy = 9;
    tail(g, 11, cy, 0, 5, 0x4d8a3a);
    g.fillStyle(0x6aa84f, 1);
    g.fillEllipse(14, cy, 13, 9);
    g.fillEllipse(22, cy, 10, 7);
    g.fillStyle(0x3d6a2a, 1);
    g.fillEllipse(13, cy, 3, 6);
    eyes(g, 22, cy, 2.2, 1.1);
  });

  makeTex(scene, 'en_raptor', 64, 32, (g) => {
    const cy = 16;
    tail(g, 24, cy, 0, 8, 0x5a4a6a);
    g.fillStyle(0x4a3a5a, 1);
    g.fillEllipse(28, cy - 8, 10, 5);
    g.fillEllipse(28, cy + 8, 10, 5);
    g.fillStyle(0x7a6a8a, 1);
    g.fillEllipse(31, cy, 24, 14);
    stripes(g, 22, 38, cy, 12, 0x3a2a4a, 3);
    g.fillStyle(0x8a7a9a, 1);
    g.fillEllipse(48, cy, 20, 11);
    g.fillStyle(0xd02030, 1);
    g.fillCircle(49, cy - 3.5, 1.8);
    g.fillCircle(49, cy + 3.5, 1.8);
  });

  makeTex(scene, 'en_dilo', 64, 44, (g) => {
    const cy = 22;
    tail(g, 24, cy, 0, 9, 0x7a9a2a);
    g.fillStyle(0x5a7a1a, 1);
    g.fillEllipse(28, cy - 9, 10, 6);
    g.fillEllipse(28, cy + 9, 10, 6);
    g.fillStyle(0x9ab83a, 1);
    g.fillEllipse(32, cy, 26, 16);
    // frill
    g.fillStyle(0xe05030, 0.9);
    g.fillTriangle(42, cy - 4, 42, cy - 20, 50, cy - 6);
    g.fillTriangle(42, cy + 4, 42, cy + 20, 50, cy + 6);
    g.fillStyle(0xf0a020, 1);
    g.fillEllipse(48, cy, 16, 11);
    g.fillStyle(0xe05030, 1);
    g.fillRect(44, cy - 1, 14, 2);
    eyes(g, 50, cy, 3.5, 1.4);
  });

  makeTex(scene, 'en_pachy', 64, 40, (g) => {
    const cy = 20;
    tail(g, 22, cy, 0, 10, 0x7a5a3a);
    g.fillStyle(0x6a4a2a, 1);
    g.fillEllipse(26, cy - 11, 12, 7);
    g.fillEllipse(26, cy + 11, 12, 7);
    g.fillStyle(0x9a7a5a, 1);
    g.fillEllipse(30, cy, 30, 22);
    g.fillStyle(0xd0b890, 1);
    g.fillCircle(48, cy, 12);
    g.fillStyle(0xe8d8b0, 1);
    g.fillCircle(49, cy, 8);
    g.fillStyle(0x6a4a2a, 1);
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i / 5) * Math.PI;
      g.fillCircle(48 + Math.cos(a) * 12, cy + Math.sin(a) * 12, 2);
    }
    eyes(g, 56, cy, 4, 1.3);
  });

  makeTex(scene, 'en_ptero', 60, 76, (g) => {
    const cy = 38;
    // wings
    g.fillStyle(0xb06a8a, 0.95);
    g.fillTriangle(26, cy - 4, 36, cy - 4, 20, 2);
    g.fillTriangle(26, cy + 4, 36, cy + 4, 20, 74);
    g.fillStyle(0x8a4a6a, 1);
    g.fillTriangle(26, cy - 3, 34, cy - 3, 24, 10);
    g.fillTriangle(26, cy + 3, 34, cy + 3, 24, 66);
    g.fillStyle(0x8a4a6a, 1);
    g.fillEllipse(30, cy, 22, 10);
    // head + crest
    g.fillStyle(0xa05a7a, 1);
    g.fillEllipse(44, cy, 12, 8);
    g.fillStyle(0xf0c060, 1);
    g.fillTriangle(46, cy - 2, 46, cy + 2, 60, cy);
    g.fillStyle(0xd07090, 1);
    g.fillTriangle(40, cy - 2, 40, cy + 2, 30, cy);
    eyes(g, 46, cy, 2.5, 1);
  });

  makeTex(scene, 'en_carno', 110, 70, (g) => {
    const cy = 35;
    tail(g, 40, cy, 2, 20, 0x80301a);
    g.fillStyle(0x602010, 1);
    g.fillEllipse(46, cy - 19, 20, 11);
    g.fillEllipse(46, cy + 19, 20, 11);
    g.fillStyle(0xa0402a, 1);
    g.fillEllipse(52, cy, 52, 36);
    stripes(g, 36, 66, cy, 30, 0x501808, 5);
    g.fillStyle(0xb04a30, 1);
    g.fillEllipse(84, cy, 30, 24);
    // horns
    g.fillStyle(0x2a1a10, 1);
    g.fillTriangle(80, cy - 10, 86, cy - 8, 76, cy - 22);
    g.fillTriangle(80, cy + 10, 86, cy + 8, 76, cy + 22);
    g.fillStyle(0x3a1008, 1);
    g.fillRect(88, cy - 1, 12, 2);
    eyes(g, 86, cy, 6, 2);
  });

  makeTex(scene, 'en_giga', 230, 140, (g) => {
    const cy = 70;
    tail(g, 80, cy, 0, 40, 0x4a3a40);
    g.fillStyle(0x302830, 1);
    g.fillEllipse(96, cy - 40, 42, 22);
    g.fillEllipse(96, cy + 40, 42, 22);
    g.fillStyle(0x5a4a50, 1);
    g.fillEllipse(108, cy, 112, 74);
    g.fillStyle(0x8a3020, 0.8);
    for (let i = 0; i < 7; i++) g.fillEllipse(70 + i * 12, cy, 5, 58 - Math.abs(i - 3) * 6);
    // spine ridge
    g.fillStyle(0x201820, 1);
    for (let i = 0; i < 8; i++) g.fillTriangle(62 + i * 12, cy - 4, 62 + i * 12, cy + 4, 70 + i * 12, cy);
    g.fillStyle(0x302830, 1);
    g.fillEllipse(142, cy - 20, 16, 10);
    g.fillEllipse(142, cy + 20, 16, 10);
    g.fillStyle(0x6a5a60, 1);
    g.fillEllipse(178, cy, 70, 52);
    g.fillStyle(0x7a6a70, 1);
    g.fillEllipse(200, cy, 44, 36);
    g.fillStyle(0xfff0d0, 1);
    for (let i = 0; i < 7; i++) {
      g.fillTriangle(186 + i * 6, cy - 16, 190 + i * 6, cy - 16, 188 + i * 6, cy - 9);
      g.fillTriangle(186 + i * 6, cy + 16, 190 + i * 6, cy + 16, 188 + i * 6, cy + 9);
    }
    g.fillStyle(0x200a0a, 1);
    g.fillRect(192, cy - 2, 34, 4);
    g.fillStyle(0xff4020, 1);
    g.fillCircle(176, cy - 16, 4.5);
    g.fillCircle(176, cy + 16, 4.5);
    g.fillStyle(0xffe060, 1);
    g.fillCircle(177, cy - 16, 1.8);
    g.fillCircle(177, cy + 16, 1.8);
  });
}

function drawFx(scene: Phaser.Scene): void {
  makeTex(scene, 'px', 6, 6, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(3, 3, 3);
  });
  makeTex(scene, 'spark', 12, 4, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 12, 4);
  });
  makeCanvas(scene, 'glow', 64, 64, (c) => {
    const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, 64, 64);
  });
  makeTex(scene, 'ring', 128, 128, (g) => {
    g.lineStyle(6, 0xffffff, 1);
    g.strokeCircle(64, 64, 60);
    g.lineStyle(3, 0xffffff, 0.4);
    g.strokeCircle(64, 64, 54);
  });
  makeTex(scene, 'jaw', 52, 22, (g) => {
    g.fillStyle(0xf8f0e0, 1);
    g.slice(26, 22, 24, Math.PI, 0, false);
    g.fillPath();
    g.fillStyle(0x301010, 1);
    g.slice(26, 22, 16, Math.PI, 0, false);
    g.fillPath();
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < 6; i++) {
      const x = 8 + i * 7.2;
      g.fillTriangle(x - 3, 22 - 2, x + 3, 22 - 2, x, 22 + 0);
      g.fillTriangle(x - 3, 14 - Math.abs(i - 2.5) * 2.5, x + 3, 14 - Math.abs(i - 2.5) * 2.5, x, 22);
    }
  });
  makeTex(scene, 'claw3', 64, 64, (g) => {
    for (let i = -1; i <= 1; i++) {
      g.lineStyle(4 - Math.abs(i), 0xffffff, 1);
      g.beginPath();
      g.arc(10, 32 + i * 12, 44, -0.55, 0.55, false);
      g.strokePath();
    }
  });
  makeCanvas(scene, 'swipe', 128, 128, (c) => {
    const grad = c.createRadialGradient(0, 64, 40, 0, 64, 128);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.75, 'rgba(255,255,255,0.35)');
    grad.addColorStop(0.95, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grad;
    c.beginPath();
    c.moveTo(0, 64);
    c.arc(0, 64, 127, -0.8, 0.8);
    c.closePath();
    c.fill();
  });

  const dna = (key: string, size: number, a: number, b: number) =>
    makeTex(scene, key, size, size, (g) => {
      const c = size / 2;
      g.fillStyle(a, 0.35);
      g.fillCircle(c, c, c);
      g.fillStyle(a, 1);
      g.fillTriangle(c, 1, size - 2, c, c, size - 1);
      g.fillTriangle(c, 1, 2, c, c, size - 1);
      g.fillStyle(b, 1);
      g.fillCircle(c, c, size * 0.18);
    });
  dna('dna1', 12, 0x50ff90, 0xffffff);
  dna('dna2', 16, 0x40c0ff, 0xffffff);
  dna('dna3', 22, 0xc060ff, 0xffffff);

  makeTex(scene, 'meat', 26, 26, (g) => {
    g.fillStyle(0xf0e8d0, 1);
    g.fillRect(3, 11, 10, 4);
    g.fillCircle(4, 10, 3);
    g.fillCircle(4, 16, 3);
    g.fillStyle(0xc03a30, 1);
    g.fillEllipse(17, 13, 16, 14);
    g.fillStyle(0xe05a40, 1);
    g.fillEllipse(18, 11, 9, 6);
  });
  makeTex(scene, 'magnet', 24, 24, (g) => {
    g.lineStyle(6, 0xe03030, 1);
    g.beginPath();
    g.arc(12, 11, 7, Math.PI, 0, true);
    g.strokePath();
    g.fillStyle(0xd0d0d0, 1);
    g.fillRect(2, 11, 6, 6);
    g.fillRect(16, 11, 6, 6);
  });
  makeTex(scene, 'mutagen', 28, 28, (g) => {
    g.fillStyle(0xc060ff, 0.35);
    g.fillCircle(14, 14, 14);
    g.fillStyle(0xd070ff, 1);
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      pts.push({ x: 14 + Math.cos(a) * 10, y: 14 + Math.sin(a) * 10 });
    }
    g.fillPoints(pts, true);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(14, 14, 4);
  });
  makeTex(scene, 'spit', 18, 14, (g) => {
    g.fillStyle(0x50c020, 0.5);
    g.fillEllipse(9, 7, 18, 12);
    g.fillStyle(0xa0ff40, 1);
    g.fillEllipse(11, 7, 10, 8);
  });
  makeTex(scene, 'rock', 16, 16, (g) => {
    g.fillStyle(0x6a6058, 1);
    g.fillCircle(8, 8, 7);
    g.fillStyle(0x9a9088, 1);
    g.fillCircle(6, 6, 3);
  });
}

function drawArena(scene: Phaser.Scene): void {
  makeCanvas(scene, 'ground', 256, 256, (c) => {
    c.fillStyle = '#3d4a2c';
    c.fillRect(0, 0, 256, 256);
    const colors = ['#435232', '#374427', '#4a5836', '#33401f', '#4d5a38'];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = colors[Math.floor(rnd() * colors.length)];
      const s = 1 + rnd() * 3;
      c.fillRect(rnd() * 256, rnd() * 256, s, s);
    }
    for (let i = 0; i < 14; i++) {
      c.fillStyle = 'rgba(80,70,40,0.25)';
      c.beginPath();
      c.ellipse(rnd() * 256, rnd() * 256, 6 + rnd() * 14, 4 + rnd() * 8, rnd() * 3, 0, Math.PI * 2);
      c.fill();
    }
  });

  makeTex(scene, 'obs_rock', 80, 80, (g) => {
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(42, 46, 76, 64);
    g.fillStyle(0x6e6a62, 1);
    g.fillCircle(40, 40, 36);
    g.fillStyle(0x8a857a, 1);
    g.fillCircle(34, 34, 26);
    g.fillStyle(0xa09a8e, 1);
    g.fillCircle(28, 28, 12);
    g.lineStyle(2, 0x4a463e, 1);
    g.lineBetween(40, 20, 50, 44);
    g.lineBetween(50, 44, 62, 50);
  });
  makeTex(scene, 'obs_trunk', 40, 40, (g) => {
    g.fillStyle(0x4a3220, 1);
    g.fillCircle(20, 20, 18);
    g.fillStyle(0x6a4a30, 1);
    g.fillCircle(20, 20, 12);
  });
  makeTex(scene, 'obs_canopy', 140, 140, (g) => {
    g.fillStyle(0x1e3a16, 1);
    g.fillCircle(70, 70, 60);
    g.fillStyle(0x2a5020, 1);
    g.fillCircle(56, 60, 38);
    g.fillCircle(86, 78, 36);
    g.fillCircle(78, 48, 30);
    g.fillStyle(0x3a6a2a, 1);
    g.fillCircle(52, 52, 20);
    g.fillCircle(84, 66, 16);
  });
  makeTex(scene, 'obs_bones', 70, 60, (g) => {
    g.lineStyle(5, 0xe8e0c8, 1);
    g.lineBetween(8, 30, 62, 30);
    for (let i = 0; i < 5; i++) {
      const x = 16 + i * 10;
      g.beginPath();
      g.arc(x, 30, 22, -2.1, -1.0, false);
      g.strokePath();
      g.beginPath();
      g.arc(x, 30, 22, 1.0, 2.1, false);
      g.strokePath();
    }
  });
  makeTex(scene, 'obs_skull', 70, 60, (g) => {
    g.fillStyle(0xe8e0c8, 1);
    g.fillEllipse(30, 30, 44, 38);
    g.fillEllipse(54, 30, 28, 22);
    g.fillStyle(0x2a2418, 1);
    g.fillCircle(30, 20, 6);
    g.fillCircle(30, 40, 6);
    g.fillEllipse(56, 30, 10, 6);
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < 4; i++) {
      g.fillTriangle(48 + i * 5, 20, 52 + i * 5, 20, 50 + i * 5, 25);
      g.fillTriangle(48 + i * 5, 40, 52 + i * 5, 40, 50 + i * 5, 35);
    }
  });
  makeTex(scene, 'decor_grass', 20, 16, (g) => {
    g.lineStyle(2, 0x5a7a3a, 1);
    g.lineBetween(4, 16, 2, 4);
    g.lineBetween(10, 16, 10, 1);
    g.lineBetween(16, 16, 18, 5);
  });
  makeTex(scene, 'decor_pebble', 12, 10, (g) => {
    g.fillStyle(0x7a7468, 1);
    g.fillEllipse(6, 5, 10, 7);
  });
  makeTex(scene, 'decor_fern', 30, 30, (g) => {
    g.fillStyle(0x2f5a24, 1);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.fillEllipse(15 + Math.cos(a) * 7, 15 + Math.sin(a) * 7, 12, 5);
    }
  });
}

export function generateTextures(scene: Phaser.Scene): void {
  drawCreatures(scene);
  drawFx(scene);
  drawArena(scene);
}
