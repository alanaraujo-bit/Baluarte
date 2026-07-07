/** Simple object pool to avoid per-frame allocations in hot paths. */
export class Pool<T> {
  private items: T[] = [];

  constructor(private readonly create: () => T, prewarm = 0) {
    for (let i = 0; i < prewarm; i++) this.items.push(create());
  }

  obtain(): T {
    return this.items.pop() ?? this.create();
  }

  free(item: T): void {
    this.items.push(item);
  }
}

/**
 * Removes the element at `i` from `arr` in O(1) by swapping with the last
 * element. Order is not preserved. Returns the removed element.
 */
export function swapRemove<T>(arr: T[], i: number): T {
  const item = arr[i];
  const last = arr.pop() as T;
  if (i < arr.length) arr[i] = last;
  return item;
}
