export type Constructor<T> = { new(): T };
export type AsyncOrSync<T> = Promise<T> | T;
