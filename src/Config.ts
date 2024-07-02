import {
  AuditLogWithoutUser,
  IAuditLogStatic,
} from "@/AuditLog";
import { EntityChangeSubscriber } from "@/EntityChangeSubscriber";
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

export class Config<U> {
  readonly useJsonB: boolean = true;
  readonly auditLogClass: IAuditLogStatic<U>;
  private readonly userClass?: UserClass<U>;
  readonly getUser?: GetUserFn<U>;
  private constructor(
    { auditLogClass }: ConfigParamsBase<U>,
    readonly user_params?: ConfigParamsExt<U>,
  ) {
    if (!this.useJsonB) {
      throw new Error("useJsonB = false not yet supported");
    }
    this.auditLogClass = auditLogClass;
    if (user_params) {
      this.userClass = user_params.userClass;
      this.getUser = user_params.getUser;
    }
  }
  getUserClass(): U extends undefined ? never : UserClass<U> {
    if (!this.userClass) {
      throw new Error("tried accessing userClass when not initialized");
    }
    return this.userClass as U extends undefined ? never : UserClass<U>;
  }
  static withUser<T, U extends Exclude<T, undefined>>(params: ConfigParamsBase<U> & ConfigParamsExt<U>): Config<U> {
    const { auditLogClass, ...rest } = params;
    return new Config<U>({ auditLogClass }, rest);
  }
  static noUser(params: ConfigParamsBase<undefined>): Config<undefined> {
    const { auditLogClass, ...rest } = params;
    return new Config<undefined>({ auditLogClass });
  }
  hasUserClass(this: Config<U>): this is Config<Exclude<U, undefined>> {
    return this.userClass !== undefined;
  }
}

const foo = new EntityChangeSubscriber(
  Config.noUser({
    auditLogClass: AuditLogWithoutUser,
  }),
);


const foo2 = new EntityChangeSubscriber(
  Config.withUser({
    auditLogClass: AuditLogWithoutUser,
    userClass: class Foo {},
  }),
);
