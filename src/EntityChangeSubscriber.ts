import { AuditLog } from "@/AuditLog";
import { Config } from "@/Config";
import {
  EntityName,
  EventSubscriber,
  FlushEventArgs,
  Ref,
  ref,
  RequestContext,
} from "@mikro-orm/core";

export class EntityChangeSubscriber<U extends object = Record<never, never>> implements EventSubscriber<unknown> {
  constructor(
    private readonly config: Config<U>,
    private readonly entityNames: EntityName<unknown>[]
  ) {}
  getSubscribedEntities(): EntityName<unknown>[] {
    return this.entityNames
  }
  async afterFlush(event: FlushEventArgs): Promise<void> {
    let hasChanges = false;
    for (const changeSet of event.uow.getChangeSets()) {
      if (changeSet.name === AuditLog.name) {
        continue;
      }
      const entry = AuditLog.from_change_set<Partial<unknown>, U>(changeSet);
      const getUser = this.config.getUser;
      if (getUser !== undefined) {
        const context = RequestContext.currentRequestContext();
        if (context == undefined) {
          throw new Error("failed to get context");
        }
        // TODO: proper typings?
        entry.user = ref(await getUser(context)) as unknown as U extends Record<never, never> ? never : Ref<U>;
      }
      event.em.persist(entry);
      hasChanges = true;
    }
    if (hasChanges) {
      await event.em.flush();
    }
  }
}
