import { Author } from "@/Author";
import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  Reference,
  UuidType,
} from "@mikro-orm/core";
import { Audit } from "mikro-orm-audit-log/decorator";

@Audit()
@Entity()
export class Book {
  @PrimaryKey({ type: UuidType })
  id!: string;

  @Property()
  name!: string;

  @ManyToOne(() => Author)
  author?: Reference<Author>;
}
