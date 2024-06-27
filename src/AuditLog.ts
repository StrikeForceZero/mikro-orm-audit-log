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
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
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

export class ChangeDataEntry<V> {
  constructor(
    readonly next?: V,
    readonly prev?: V,
  ) {
  }
}
export class ChangeData<T> {
  changes?: {
    [K in EntityKey<T>]?: ChangeDataEntry<EntityData<T>[K]>;
  };
}

@Entity({ abstract: true })
export class AuditLog<T, U = undefined> {
  @PrimaryKey()
  id!: UuidType;

  @Index()
  @Property()
  entityName!: string;

  @Index()
  @Property({ type: "jsonb" })
  entityId!: Primary<T> | null;

  @Index()
  @Enum()
  changeType!: ChangeType;

  @Property({ type: "jsonb" })
  changes!: ChangeData<T>;

  @Property()
  timestamp: Date = new Date();

  @ManyToOne()
  user?: U;

  static from_change_set<T extends object, U = undefined>(changeSet: ChangeSet<T>): AuditLog<T, U> {
    const prev = changeSet.originalEntity;
    const next = changeSet.payload;
    const entry = new AuditLog<T, U>();
    entry.changeType = ChangeType.from_change_set_type(changeSet.type);
    entry.entityName = changeSet.name;
    entry.entityId = changeSet.getPrimaryKey(true);
    entry.changes = {};
    for (const prop in next) {
      const key = prop as EntityKey<T>;
      const prevValue = prev?.[key];
      const nextValue = next[key];
      if (prevValue !== nextValue) {
        // TODO: proper typings possible?
        entry.changes[key] = new ChangeDataEntry(prevValue, nextValue) as ChangeData<T>[EntityKey<T>];
      }
    }
    return entry;
  }
}
