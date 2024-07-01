
import { AuditLog } from "@/AuditLog";
import {
  Ref,
  RequestContext,
} from "@mikro-orm/core";

// TODO: util type
type AsyncOrSync<T> = Promise<T> | T;

export class Config<U extends object = Record<never, never>> {
  readonly useJsonB: boolean = true;
  constructor(
    readonly getUser?: (context: RequestContext) => AsyncOrSync<U extends Record<never, never> ? never : Ref<U>>,
  ) {
    if (!this.useJsonB) {
      throw new Error("useJsonB = false not yet supported");
    }
  }
}
