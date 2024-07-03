import {
  getAuditIgnoreMetadata,
  getAuditRedactMetadata,
} from "@/decorator";
import {
  Constructor,
  OccludeWith,
} from "@/types";
import {
  Entity,
  Platform,
  Primary,
  Type,
} from "@mikro-orm/core";
import * as MikroOrm from "@mikro-orm/core";
import { v4 } from "uuid";

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

export interface IChangeValuePojo<V> {
  marker: ChangeValueMarker,
  value?: V
}

export interface IChangeValue<V> {
  marker: ChangeValueMarker;
  value?: V;
  toString(): string;
  valueOf(): V | undefined;
  toJSON(): IChangeValuePojo<V>;
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
    toJSON(): IChangeValuePojo<T> {
      return {
        marker: this.marker,
        value: this.value,
      };
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
    toJSON(): IChangeValuePojo<T> {
      return {
        marker: this.marker,
        value: undefined,
      };
    },
  };
}

interface IChangeDataEntry<V> {
  prev?: IChangeValue<V>,
  next?: IChangeValue<V>,
}

function createChangeDataEntry<V>(
    prev?: IChangeValue<V>,
    next?: IChangeValue<V>,
  ): IChangeDataEntry<V>
{
  return {
    prev,
    next,
  };
}

export class ChangeData<T extends {}> {
  data: {
    [K in MikroOrm.EntityKey<T>]?: IChangeDataEntry<MikroOrm.EntityData<T>[K]>;
  } = {};
  hasChanges(): boolean {
    return Object.keys(this.data).length > 0;
  }
}

export class ChangeDataType<T extends {}> extends Type<ChangeData<T>, object | string | null> {
  override convertToDatabaseValue(value: ChangeData<T> | undefined, _platform: Platform): object | string | null {
    return value ? JSON.stringify(value) : null;
  }

  override convertToJSValue(value: string | object | null | undefined, _platform: Platform): ChangeData<T> {
    return value ? Object.assign(new ChangeData(), typeof value === "string" ? JSON.parse(value) : value) : new ChangeData();
  }

  override getColumnType(_prop: any, _platform: Platform) {
    return 'jsonb';
  }
}

export interface IAuditLogBase<T extends {}, U = undefined> {
  id: string,
  entityName: string,
  entityId: Primary<T> | null,
  changeType: ChangeType,
  changes: ChangeData<T>,
  timestamp: Date,
  user?: MikroOrm.Ref<U>,
}

// FIXME: this is really gross that we need to override IAuditLogBase with C
export interface IAuditLogStatic<U = never, C extends {} = {},> {
  new<T extends {}>(): OccludeWith<IAuditLogBase<T, U>, C>;
  id_factory(): string;
  // FIXME: since we can't read the generics from the class definition when calling statics we need to allow them to be specified
  // unfortunately this breaks the compatibility inference between a concrete implementation and the IAuditLogStatic
  // this also might break the inference for entityIda as well?
  // and forces us to add the C generic for overriding
  from_change_set<T extends {}, U2 extends U = U>(changeSet: MikroOrm.ChangeSet<T>): OccludeWith<IAuditLogBase<T, U2>, C> | null;
}

@MikroOrm.Entity({ abstract: true })
abstract class AuditLogBase<T extends {}, U = undefined> implements IAuditLogBase<T, U> {
  @MikroOrm.PrimaryKey({ type: MikroOrm.UuidType })
  id!: string;

  @MikroOrm.Index()
  @MikroOrm.Property()
  entityName!: string;

  @MikroOrm.Index()
  @MikroOrm.Property({ type: "jsonb" })
  entityId!: Primary<T> | null;

  @MikroOrm.Index()
  @MikroOrm.Enum()
  changeType!: ChangeType;

  @MikroOrm.Property({ type: ChangeDataType<T> })
  changes!: ChangeData<T>;

  @MikroOrm.Property()
  timestamp: Date = new Date();

  static id_factory() {
    return v4();
  };

  static _from_change_set<ALI extends IAuditLogBase<T, U>, ALS extends OccludeWith<IAuditLogStatic<U>, Constructor<ALI>>, T extends {}, U>(Alc: ALS, changeSet: MikroOrm.ChangeSet<T>): ALI | null {
    const prev = changeSet.originalEntity;
    const next = changeSet.payload;
    const entry = new Alc();
    entry.id = Alc.id_factory();
    entry.changeType = ChangeType.from_change_set_type(changeSet.type);
    entry.entityName = changeSet.name;
    entry.entityId = changeSet.getPrimaryKey(true);
    entry.changes = new ChangeData();
    for (const prop in next) {
      const key = prop as MikroOrm.EntityKey<T>;
      const prevValue = prev?.[key];
      const nextValue = next[key];
      if (prevValue !== nextValue) {
        if (getAuditIgnoreMetadata(changeSet.entity, key)) {
          continue;
        }
        const valueWrap = getAuditRedactMetadata(changeSet.entity, key) ? Redacted : Value;
        entry.changes.data[key] = createChangeDataEntry(valueWrap(prevValue), valueWrap(nextValue));
      }
    }
    if (!entry.changes.hasChanges()) {
      return null;
    }
    return entry;
  }
}

@Entity()
export class AuditLogWithUser<T extends {}, U extends {}> extends AuditLogBase<T, U> {
  @MikroOrm.ManyToOne()
  user?: MikroOrm.Ref<U>;

  static override id_factory(): string {
    return super.id_factory();
  }

  static from_change_set<T extends {}, U extends {}>(changeSet: MikroOrm.ChangeSet<T>): AuditLogWithUser<T, U> | null {
    // TODO: Why do we need to cast the types when calling _from_change_set but AuditLogWithoutUser doesn't
    return super._from_change_set<AuditLogWithUser<T, U>, typeof AuditLogWithUser<T, U>, T, U>(AuditLogWithUser<T, U>, changeSet);
  }
}

@Entity()
export class AuditLogWithoutUser<T extends {}> extends AuditLogBase<T> {
  static override id_factory(): string {
    return super.id_factory();
  }

  static from_change_set<T extends {}, U extends undefined = undefined>(changeSet: MikroOrm.ChangeSet<T>): AuditLogWithoutUser<T> | null {
    return super._from_change_set(AuditLogWithoutUser<T>, changeSet);
  }
}

export type AuditLog<U> = IAuditLogStatic<U, {}>;

{
  // ensure static class complies with IAuditLogStatic
  const _AuditLogWithUser: IAuditLogStatic<{}, AuditLogWithUser<{}, {}>> = AuditLogWithUser<{}, {}>;
  const _AuditLogWithoutUser: IAuditLogStatic<{}, AuditLogWithoutUser<{}>> = AuditLogWithoutUser<{}>;
}
