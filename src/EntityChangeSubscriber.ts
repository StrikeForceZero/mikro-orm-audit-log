import {
  Config,
} from "@/Config";
import { GlobalStorage } from "@/decorator/Audit";
import {
  EntityName,
  EventSubscriber,
  FlushEventArgs,
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
  async beforeFlush(event: FlushEventArgs): Promise<void> {
    event.uow.computeChangeSets();
    for (const changeSet of event.uow.getChangeSets()) {
      if (changeSet.name === this.config.auditLogClass.name) {
        continue;
      }

      const entry = this.config.auditLogClass.from_change_set<Partial<unknown>>(changeSet);
      if (this.config.hasUserClass()) {

        if (this.config.getUser) {
          const context = RequestContext.currentRequestContext();
          if (context == undefined) {
            throw new Error("failed to get context");
          }

          entry.user = await this.config.getUser(context);
        }
      }
      event.em.persist(entry);
    }
  }
}
