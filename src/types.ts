export type Constructor<T> = { new(): T };
export type AsyncOrSync<T> = Promise<T> | T;
/** Shallow merge and overwrite target with source like Object.assign() */
export type OccludeWith<TARGET, SOURCE> = Omit<TARGET, keyof SOURCE> & SOURCE;
