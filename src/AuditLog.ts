import { Config } from "@/Config";
import {
  getAuditIgnoreMetadata,
  getAuditRedactMetadata,
} from "@/decorator";
import { Constructor } from "@/types";
import {
  Entity,
  RequestContext,
} from "@mikro-orm/core";
import * as MikroOrm from "@mikro-orm/core";

export enum ChangeType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
}

export namespace ChangeType {
  export function from_change_set_type(changeSetType: MikroOrm.ChangeSetType): ChangeType {
    switch (changeSetType) {
      case MikroOrm.ChangeSetType.CREATE:
        return ChangeType.CREATE;
      case MikroOrm.ChangeSetType.UPDATE:
      case MikroOrm.ChangeSetType.UPDATE_EARLY:
        return ChangeType.UPDATE;
      case MikroOrm.ChangeSetType.DELETE:
      case MikroOrm.ChangeSetType.DELETE_EARLY:
        return ChangeType.DELETE;
      default:
        throw new Error(`unknown ChangeSetType type: ${changeSetType}`);
    }
  }
}

export enum ChangeValueMarker {
  Value = "value",
  Redacted = "redacted",
}

export interface IChangeValue<V> {
  marker: ChangeValueMarker;
  value?: V;

  toString(): string;

  valueOf(): V | undefined;

  toJSON(): string;
}

function Value<T>(value: T): IChangeValue<T> {
  return {
    marker: ChangeValueMarker.Value,
    value,
    toString(): string {
      return String(value);
    },
    valueOf(): T | undefined {
      return value;
    },
    toJSON(): string {
      return JSON.stringify({
        marker: this.marker,
        value: this.value,
      });
    },
  };
}

function Redacted<T>(_value: T): IChangeValue<T> {
  return {
    marker: ChangeValueMarker.Redacted,
    value: undefined,
    toString(): string {
      return "[REDACTED]";
    },
    valueOf(): T | undefined {
      return undefined;
    },
    toJSON(): string {
      return JSON.stringify({
        marker: this.marker,
        value: this.value,
      });
    },
  };
}

export class ChangeDataEntry<V> {
  constructor(
    public readonly next?: IChangeValue<V>,
    public readonly prev?: IChangeValue<V>,
  ) {
  }
}

export class ChangeData<T> {
  data: {
    [K in MikroOrm.EntityKey<T>]?: ChangeDataEntry<MikroOrm.EntityData<T>[K]>;
  } = {};
}

export interface IAuditLogBase<T, U = undefined> {
  id: MikroOrm.UuidType,
  entityName: string,
  entityId: Record<string, unknown> | null,
  changeType: ChangeType,
  changes: ChangeData<T>,
  timestamp: Date,
  user?: MikroOrm.Ref<U>,
}

export interface IAuditLogStatic<U = never> {
  new<T>(): IAuditLogBase<T, U>;
  from_change_set<T extends object, U2 = U>(changeSet: MikroOrm.ChangeSet<T>): IAuditLogBase<T, U2>;
}

@MikroOrm.Entity({ abstract: true })
abstract class AuditLogBase<T, U = undefined> implements IAuditLogBase<T, U> {
  @MikroOrm.PrimaryKey()
  id!: MikroOrm.UuidType;

  @MikroOrm.Index()
  @MikroOrm.Property()
  entityName!: string;

  @MikroOrm.Index()
  @MikroOrm.Property({ type: "jsonb" })
  entityId!: Record<string, unknown> | null;

  @MikroOrm.Index()
  @MikroOrm.Enum()
  changeType!: ChangeType;

  @MikroOrm.Property({ type: "jsonb" })
  changes!: ChangeData<T>;

  @MikroOrm.Property()
  timestamp: Date = new Date();

  static _from_change_set<ALI extends IAuditLogBase<T, U>, ALS extends Constructor<ALI>, T, U>(Alc: ALS, changeSet: MikroOrm.ChangeSet<T & {}>): ALI {
    const prev = changeSet.originalEntity;
    const next = changeSet.payload;
    const entry = new Alc();
    entry.changeType = ChangeType.from_change_set_type(changeSet.type);
    entry.entityName = changeSet.name;
    // TODO: proper typings possible?
    entry.entityId = changeSet.getPrimaryKey(true) as Record<string, unknown>;
    entry.changes = new ChangeData();
    for (const prop in next) {
      const key = prop as MikroOrm.EntityKey<T>;
      const prevValue = prev?.[key];
      const nextValue = next[key];
      if (prevValue !== nextValue) {
        if (getAuditIgnoreMetadata(changeSet.entity, key)) {
          continue;
        }
        let changeEntryValueTuple: [IChangeValue<typeof prevValue>, IChangeValue<typeof nextValue>] = (
          () => {
            if (getAuditRedactMetadata(changeSet.entity, key)) {
              return [Redacted(prevValue), Redacted(nextValue)];
            }
            else {
              return [Value(prevValue), Value(nextValue)];
            }
          }
        )();
        entry.changes.data[key] = new ChangeDataEntry(...changeEntryValueTuple);
      }
    }
    return entry;
  }
}

@Entity()
export class AuditLogWithUser<T, U extends {}> extends AuditLogBase<T, U> {
  @MikroOrm.ManyToOne()
  user?: MikroOrm.Ref<U>;

  static from_change_set<T, U extends {}>(changeSet: MikroOrm.ChangeSet<T & {}>): AuditLogWithUser<T, U> {
    return super._from_change_set<InstanceType<Constructor<AuditLogWithUser<T, U>>>, typeof AuditLogWithUser<T, U>, T, U>(AuditLogWithUser<T, U>, changeSet);
  }
}

@Entity()
export class AuditLogWithoutUser<T> extends AuditLogBase<T> {
  static from_change_set<T, U extends undefined = undefined>(changeSet: MikroOrm.ChangeSet<T & {}>): AuditLogWithoutUser<T> {
    return super._from_change_set(AuditLogWithoutUser<T>, changeSet);
  }
}

export type AuditLog<U> = IAuditLogStatic<U>;
