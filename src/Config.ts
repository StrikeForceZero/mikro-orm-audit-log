import {
  IAuditLogStatic,
} from "@/AuditLog";
import {
  AsyncOrSync,
  Constructor,
} from "@/types";
import {
  Ref,
  RequestContext,
} from "@mikro-orm/core";

export type UserClass<U> = Constructor<U>;
export type GetUserFn<U> = (context: RequestContext) => AsyncOrSync<Ref<U>>;

export type ConfigParamsBase<U> = {
  auditLogClass: IAuditLogStatic<U>,
};

export type ConfigParamsExt<U> = {
  userClass: UserClass<U>;
  getUser?: GetUserFn<U>,
};
export type ConfigParams<U> = U extends never ? ConfigParamsBase<never> & ConfigParamsExt<never> : ConfigParamsBase<U> & ConfigParamsExt<U>;

function hasExtraProps<T extends Record<string, unknown>, Y, P extends keyof Y = keyof Y>(v: T | T & Y, k: P): v is T & Y {
  return v.hasOwnProperty(k) !== undefined;
}

export class Config<U> {
  readonly useJsonB: boolean = true;
  readonly auditLogClass: IAuditLogStatic<U>;
  readonly userClass!: UserClass<U>;
  readonly getUser?: GetUserFn<U>;
  constructor(
    readonly params: ConfigParams<U>,
  ) {
    if (!this.useJsonB) {
      throw new Error("useJsonB = false not yet supported");
    }
    this.auditLogClass = params.auditLogClass;
    if (hasExtraProps<ConfigParams<U>, ConfigParamsExt<U>>(params, 'userClass')) {
      this.userClass = params.userClass;
      this.getUser = params.getUser;
    }
  }
  hasUserClass(this: Config<U>): this is Config<Exclude<U, never>> {
    return this.userClass !== undefined;
  }
}
