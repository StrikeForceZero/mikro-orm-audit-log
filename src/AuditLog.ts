import {
  getAuditIgnoreMetadata,
  getAuditRedactMetadata,
} from "@/decorator";
import {
  ChangeSet,
  ChangeSetType,
  Entity,
  Enum,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  UuidType,
  Primary,
  EntityData,
  EntityKey,
  EntityDictionary,
} from "@mikro-orm/core";

export enum ChangeType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
}

export namespace ChangeType {
  export function from_change_set_type(changeSetType: ChangeSetType): ChangeType {
    switch (changeSetType) {
      case ChangeSetType.CREATE:
        return ChangeType.CREATE;
      case ChangeSetType.UPDATE:
      case ChangeSetType.UPDATE_EARLY:
        return ChangeType.UPDATE;
      case ChangeSetType.DELETE:
      case ChangeSetType.DELETE_EARLY:
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
    [K in EntityKey<T>]?: ChangeDataEntry<EntityData<T>[K]>;
  } = {};
}

@Entity({ abstract: true })
export class AuditLog<T extends object, U extends object = Record<never, never>> {
  @PrimaryKey()
  id!: UuidType;

  @Index()
  @Property()
  entityName!: string;

  @Index()
  @Property({ type: "jsonb" })
  entityId!: Record<string, unknown> | null;

  @Index()
  @Enum()
  changeType!: ChangeType;

  @Property({ type: "jsonb" })
  changes!: ChangeData<T>;

  @Property()
  timestamp: Date = new Date();

  @ManyToOne()
  user?: Reference<U>;

  static from_change_set<T extends object, U extends object = Record<never, never>>(changeSet: ChangeSet<T>): AuditLog<T, U> {
    const prev = changeSet.originalEntity;
    const next = changeSet.payload;
    const entry = new AuditLog<T, U>();
    entry.changeType = ChangeType.from_change_set_type(changeSet.type);
    entry.entityName = changeSet.name;
    // TODO: proper typings possible?
    entry.entityId = changeSet.getPrimaryKey(true) as Record<string, unknown>;
    entry.changes = new ChangeData();
    for (const prop in next) {
      const key = prop as EntityKey<T>;
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
