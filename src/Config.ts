import { createAuditLogCls } from "@/AuditLog";
import {
  Ref,
  RequestContext,
} from "@mikro-orm/core";

// TODO: util type
type AsyncOrSync<T> = Promise<T> | T;

export class Config<U> {
  readonly useJsonB: boolean = true;
  constructor(
    readonly userCls: { new(): U },
    readonly auditLogCls = createAuditLogCls(userCls),
    readonly getUser?: (context: RequestContext) => AsyncOrSync<Ref<U>>,
  ) {
    if (!this.useJsonB) {
      throw new Error("useJsonB = false not yet supported");
    }
  }
}
