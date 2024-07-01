import {
  getAuditIgnoreMetadata,
  getAuditRedactMetadata,
} from "@/decorator";
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

export interface IAuditLog<T, U> {
  id: MikroOrm.UuidType,
  entityName: string,
  entityId: Record<string, unknown> | null,
  changeType: ChangeType,
  changes: ChangeData<T>,
  timestamp: Date,
  user?: MikroOrm.Ref<U>,
}

export interface IAuditLogStatic<U> {
  new<T>(): IAuditLog<T, U>;
  from_change_set<T extends object>(changeSet: MikroOrm.ChangeSet<T>): IAuditLog<T, U>;
}

export function createAuditLogCls<U>(userCls: { new(): U }): IAuditLogStatic<U> {
  @MikroOrm.Entity()
  class AuditLog<T extends object> implements IAuditLog<T, U> {
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

    @MikroOrm.ManyToOne(userCls.name)
    user?: MikroOrm.Ref<U>;

    static from_change_set<T extends object>(changeSet: MikroOrm.ChangeSet<T>): AuditLog<T> {
      const prev = changeSet.originalEntity;
      const next = changeSet.payload;
      const entry = new AuditLog<T>();
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
  return AuditLog;
}
