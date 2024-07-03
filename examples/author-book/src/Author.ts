import { Book } from "@/Book";
import {
  Collection,
  Entity,
  OneToMany,
  PrimaryKey,
  Property,
  UuidType,
} from "@mikro-orm/core";
import {
  Audit,
  AuditIgnore,
  AuditRedact,
} from "mikro-orm-audit-log/decorator";

@Audit()
@Entity()
export class Author {
  @PrimaryKey({ type: UuidType })
  id!: string;

  @Property()
  name!: string;

  @AuditRedact()
  @Property()
  secret!: string;

  @AuditIgnore()
  @Property()
  bookCountCache!: number;

  @OneToMany(() => Book, book => book.author)
  books?: Collection<Book>;
}
