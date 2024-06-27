
import { AuditLog } from "@/AuditLog";
import { RequestContext } from "@mikro-orm/core";

export class Config<U = undefined> {
  readonly useJsonB: boolean = true;
  constructor(
    readonly getUser?: (context: RequestContext) => Promise<U> | U,
  ) {
    if (!this.useJsonB) {
      throw new Error("useJsonB = false not yet supported");
    }
  }
  protected getInternalEntities(): unknown[] {
    return [AuditLog];
  }
}
