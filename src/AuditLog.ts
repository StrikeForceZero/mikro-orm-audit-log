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

@MikroOrm.Entity({ abstract: true })
export class AuditLog<T extends object, U extends object = Record<never, never>> {
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

  @MikroOrm.ManyToOne()
  user?: MikroOrm.Reference<U>;

  entityPrimaryKey(): MikroOrm.Primary<T> {
    return this.entityId as MikroOrm.Primary<T>;
  }

  async tryLoadLatestVersionOfEntity(em: MikroOrm.EntityManager): Promise<T | undefined> {
    return await em.getRepository<T>(this.entityName).findOne({
      // TODO: proper types?
      ...this.entityPrimaryKey() as object,
    }) as T | undefined;
  }

  /**
   * Builds the entity from all AuditLog entries prior
   * @param em
   */
  async fromUpToHere(em: MikroOrm.EntityManager): Promise<T> {
    const entries = await em.getRepository(AuditLog<T, U>).findAll({
      where: {
        entityName: this.entityName,
        entityId: this.entityId,
        timestamp: { $lte: this.timestamp },
      },
      orderBy: {
        [AuditLog.name]: {
          timestamp: 'asc',
        },
      },
    });
    const entity: Record<string, unknown> = {};
    for (const entry of entries) {
      const data = entry.changes.data;
      for (const key in data) {
        const change = data[key as keyof typeof data];
        if (change === undefined) {
          continue;
        }
        if (change.next == undefined) {
          continue;
        }
        if (change.next.marker === ChangeValueMarker.Redacted) {
          continue;
        }
        // TODO: consequences?
        entity[key] = change.next.value as T[keyof T];
      }
    }
    return em.getRepository<T>(this.entityName).create(entity as T);
  }

  /**
   * Builds the entity from undoing all AuditLog entries after
   * @param em
   */
  async fromDownToHere(em: MikroOrm.EntityManager): Promise<T> {
    const entries = await em.getRepository(AuditLog<T, U>).findAll({
      where: {
        entityName: this.entityName,
        entityId: this.entityId,
        timestamp: { $gte: this.timestamp },
      },
      orderBy: {
        [AuditLog.name]: {
          timestamp: 'dsc',
        },
      },
    });
    const entity = await this.tryLoadLatestVersionOfEntity(em) ?? {} as T;
    for (const entry of entries) {
      const data = entry.changes.data;
      for (const key in data) {
        const change = data[key as keyof typeof data];
        if (change === undefined) {
          continue;
        }
        if (change.next == undefined) {
          continue;
        }
        if (change.next.marker === ChangeValueMarker.Redacted) {
          continue;
        }
        // TODO: consequences?
        entity[key as keyof T] = change.next.value as T[keyof T];
      }
    }
    return em.getRepository<T>(this.entityName).create(entity as T);

  }

  /**
   * Reverts changes in this entry if they match the latest value
   * @param em
   */
  async undoUnchanged(em: MikroOrm.EntityManager): Promise<T | undefined> {
    const entries = await em.getRepository(AuditLog<T, U>).findAll({
      where: {
        entityName: this.entityName,
        entityId: this.entityId,
        timestamp: { $gte: this.timestamp },
      },
      orderBy: {
        [AuditLog.name]: {
          timestamp: 'asc',
        },
      },
      limit: 1,
    });
    const entity = await this.tryLoadLatestVersionOfEntity(em) as T;
    if (entity === undefined) {
      return undefined;
    }
    if (entries.length !== 1) {
      throw new Error("expected 1 entry");
    }
    for (const entry of entries) {
      for (const key in entry.changes.data) {
        const change = entry.changes.data[key];
        if (change === undefined) {
          continue;
        }
        if (change.next?.marker === ChangeValueMarker.Value) {
          if (change.next.value === entity[key as keyof T]) {
            entity[key as keyof T] = change.prev?.value as T[keyof T];
          }
        }
      }
    }
    return entity;
  }

  static from_change_set<T extends object, U extends object = Record<never, never>>(changeSet: MikroOrm.ChangeSet<T>): AuditLog<T, U> {
    const prev = changeSet.originalEntity;
    const next = changeSet.payload;
    const entry = new AuditLog<T, U>();
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
