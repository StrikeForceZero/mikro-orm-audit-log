export function entries<T extends {} | []>(v: T): ([keyof T, T[keyof T]])[] {
  return Object.entries(v) as unknown as ([keyof T, T[keyof T]])[];
}

export function keys<T extends {} | []>(v: T): (keyof T)[] {
  return Object.keys(v) as unknown as (keyof T)[];
}
