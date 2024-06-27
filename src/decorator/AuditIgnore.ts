import 'reflect-metadata';

export const KEY = "AUDIT_IGNORE";

export function AuditIgnore() {
  return function (target: any, propertyKey?: string | symbol) {
    if (propertyKey) {
      // If applied to a property or method
      Reflect.defineMetadata(KEY, true, target, propertyKey);
    } else {
      // If applied to a class
      Reflect.defineMetadata(KEY, true, target);
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
