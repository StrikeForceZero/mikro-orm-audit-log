import { Author } from "@/Author";
import { Book } from "@/Book";
import {
  MikroORMOptions,
  ref,
} from "@mikro-orm/core";
import { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { AuditLogWithoutUser } from "mikro-orm-audit-log/AuditLog";
import {
  Config,
} from "mikro-orm-audit-log/Config";
import { EntityChangeSubscriber } from "mikro-orm-audit-log/EntityChangeSubscriber";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";

export const config: Partial<MikroORMOptions> = {
  tsNode: true,
  entities: [AuditLogWithoutUser, Author, Book],
  clientUrl: 'postgresql://postgres:password@127.0.0.1:5432/author-book',
  subscribers: [
    new EntityChangeSubscriber(
      Config.noUser({
        auditLogClass: AuditLogWithoutUser,
      }),
    ),
  ],
  driver: PostgreSqlDriver,
  metadataProvider: TsMorphMetadataProvider,
}

export default config;
