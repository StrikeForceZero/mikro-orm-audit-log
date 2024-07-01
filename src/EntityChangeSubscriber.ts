import { Config } from "@/Config";
import { GlobalStorage } from "@/decorator/Audit";
import {
  EntityName,
  EventSubscriber,
  FlushEventArgs,
  ref,
  RequestContext,
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
      if (changeSet.name === this.config.auditLogCls.name) {
        continue;
      }
      const entry = this.config.auditLogCls.from_change_set<Partial<unknown>>(changeSet);
      const context = RequestContext.currentRequestContext();
      if (context == undefined) {
        throw new Error("failed to get context");
      }
      const getUser = this.config.getUser ?? (_ => ref(new this.config.userCls()));
      entry.user = await getUser(context);
      event.em.persist(entry);
      hasChanges = true;
    }
    if (hasChanges) {
      await event.em.flush();
    }
  }
}
