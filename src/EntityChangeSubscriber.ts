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

      const entry = this.config.auditLogClass.from_change_set<Partial<unknown>, InstanceType<typeof this.config.userClass>>(changeSet);

      if (this.config.hasUserClass() && entry.expectsUser()) {
        if (this.config.getUser) {
          const context = RequestContext.currentRequestContext();
          if (context == undefined) {
            throw new Error("failed to get context");
          }

          // TODO: why is entry not getting type narrowed?
          entry.user = await this.config.getUser(context) as (InstanceType<UserClass<U>> extends never ? never : Ref<InstanceType<UserClass<U>>>) & Ref<InstanceType<UserClass<U>>>;

        }
      }
      event.em.persist(entry);
      hasChanges = true;
    }
    if (hasChanges) {
      await event.em.flush();
    }
  }
}
