/**
 * Fixed-capacity object pool with an "active prefix" layout.
 *
 * All objects are allocated once. Active items live in items[0..count-1].
 * Removal is O(1) swap-with-last (no splice, no GC churn), which keeps the
 * hot projectile/particle loops allocation-free at 60 FPS.
 */
export class Pool<T> {
  readonly items: T[];
  count = 0;

  constructor(capacity: number, factory: () => T) {
    this.items = new Array<T>(capacity);
    for (let i = 0; i < capacity; i++) this.items[i] = factory();
  }

  get capacity() {
    return this.items.length;
  }

  /** Returns a recycled object to initialise, or null when the pool is full. */
  spawn(): T | null {
    if (this.count >= this.items.length) return null;
    return this.items[this.count++]!;
  }

  /** Like spawn() but overwrites the oldest active item when full. */
  spawnForced(): T {
    const o = this.spawn();
    if (o) return o;
    return this.items[0]!;
  }

  removeAt(i: number) {
    const last = this.count - 1;
    if (i < 0 || i > last) return;
    if (i !== last) {
      const tmp = this.items[i]!;
      this.items[i] = this.items[last]!;
      this.items[last] = tmp;
    }
    this.count--;
  }

  clear() {
    this.count = 0;
  }
}
