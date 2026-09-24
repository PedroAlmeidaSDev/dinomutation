export interface GridItem {
  x: number;
  y: number;
  radius: number;
}

/**
 * Uniform grid rebuilt every frame. Items are inserted by center only;
 * queries expand by the largest radius seen so circles are never missed.
 */
export class SpatialGrid<T extends GridItem> {
  private cells = new Map<number, T[]>();
  private maxRadius = 0;

  constructor(private readonly cellSize: number) {}

  private key(cx: number, cy: number): number {
    return (cx + 4096) * 8192 + (cy + 4096);
  }

  clear(): void {
    this.cells.clear();
    this.maxRadius = 0;
  }

  insert(item: T): void {
    const cx = Math.floor(item.x / this.cellSize);
    const cy = Math.floor(item.y / this.cellSize);
    const k = this.key(cx, cy);
    let cell = this.cells.get(k);
    if (!cell) {
      cell = [];
      this.cells.set(k, cell);
    }
    cell.push(item);
    if (item.radius > this.maxRadius) this.maxRadius = item.radius;
  }

  /** Items whose circle overlaps the query circle. */
  query(x: number, y: number, r: number, out: T[] = []): T[] {
    const reach = r + this.maxRadius;
    const minX = Math.floor((x - reach) / this.cellSize);
    const maxX = Math.floor((x + reach) / this.cellSize);
    const minY = Math.floor((y - reach) / this.cellSize);
    const maxY = Math.floor((y + reach) / this.cellSize);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (!cell) continue;
        for (const it of cell) {
          const dx = it.x - x;
          const dy = it.y - y;
          const rr = r + it.radius;
          if (dx * dx + dy * dy <= rr * rr) out.push(it);
        }
      }
    }
    return out;
  }
}
