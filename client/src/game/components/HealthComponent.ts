export class HealthComponent {
  current: number;

  constructor(public max: number) {
    this.current = max;
  }

  get ratio(): number {
    return this.max > 0 ? this.current / this.max : 0;
  }

  get isDead(): boolean {
    return this.current <= 0;
  }

  /** Returns the damage actually applied. */
  damage(amount: number): number {
    const applied = Math.min(this.current, Math.max(0, amount));
    this.current -= applied;
    return applied;
  }

  /** Returns the amount actually healed. */
  heal(amount: number): number {
    const before = this.current;
    this.current = Math.min(this.max, this.current + Math.max(0, amount));
    return this.current - before;
  }

  /** Change max HP, keeping the missing amount constant (gaining max HP also heals). */
  setMax(newMax: number): void {
    const delta = newMax - this.max;
    this.max = Math.max(1, newMax);
    if (delta > 0) this.current += delta;
    this.current = Math.min(this.current, this.max);
  }
}
