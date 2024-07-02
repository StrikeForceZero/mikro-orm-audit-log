import {
  Config,
  UserClass,
} from "@/Config";
import { GlobalStorage } from "@/decorator/Audit";
import {
  EntityName,
  EventSubscriber,
  FlushEventArgs,
  Ref,
  RequestContext,
  t,
} from "@mikro-orm/core";

export class EntityChangeSubscriber<U> implements EventSubscriber<unknown> {
  constructor(
    private readonly config: Config<U>,
    private readonly entityNames: EntityName<unknown>[] = [],
  ) {}
  getSubscribedEntities(): EntityName<unknown>[] {
    return [
      ...Object.keys(GlobalStorage),
      ...this.entityNames,
    ];
  }
  async afterFlush(event: FlushEventArgs): Promise<void> {
    let hasChanges = false;
    for (const changeSet of event.uow.getChangeSets()) {
      if (changeSet.name === this.config.auditLogClass.name) {
        continue;
      }

      const entry = this.config.auditLogClass.from_change_set<Partial<unknown>>(changeSet);
      const context = RequestContext.currentRequestContext();
      if (!context) {
        throw new Error("failed to get context");
      }
      entry.onAfterFlushBeforeEntryPersist(this.config, context, entry);

      event.em.persist(entry);
      hasChanges = true;
    }
    if (hasChanges) {
      await event.em.flush();
    }
  }
}
