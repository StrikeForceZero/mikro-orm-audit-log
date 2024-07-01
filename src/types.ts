export type Constructor<T> = T extends never ? never : { new(): T };
export type AsyncOrSync<T> = T extends never ? never : Promise<T> | T;
