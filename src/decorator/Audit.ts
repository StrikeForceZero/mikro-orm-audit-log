import 'reflect-metadata';

export const GlobalStorage: Record<string, unknown> = {};

export const KEY = "AUDIT";

export function Audit() {
  return function (target: any, propertyKey?: string | symbol) {
    if (propertyKey) {
      // If applied to a property or method
      throw new Error("@Audit() can only be defined at the class level")
    } else {
      // If applied to a class
      Reflect.defineMetadata(KEY, true, target);
      GlobalStorage[target.name] = target;
    }
  };
}

export function getMetadata(target: any, propertyKey?: string | symbol): boolean {
  if (propertyKey) {
    return Reflect.getMetadata(KEY, target, propertyKey);
  } else {
    return Reflect.getMetadata(KEY, target);
  }
}
