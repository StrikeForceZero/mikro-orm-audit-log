import { Author } from "@/Author";
import { Book } from "@/Book";
import {
  ref,
} from "@mikro-orm/core";
import { MikroORM } from "@mikro-orm/postgresql";
import { AuditLogWithoutUser } from "mikro-orm-audit-log/AuditLog";
import config from '../mikro-orm.config';
import { v4 } from "uuid";

async function main() {
  const orm = await MikroORM.init(config);
  const em = orm.em.fork();
  const author = em.create(Author, {
    id: v4(),
    name: "author A",
    secret: "secret thing",
    bookCountCache: 0,
  }, {
    persist: true,
  });
  await em.flush();
  const book = em.create(Book, {
    id: v4(),
    name: "book A",
    author: ref(author),
  }, {
    persist: true,
  });
  author.bookCountCache += 1;
  await em.flush();
  book.name = "book A.rev2";
  await em.flush();
  const logs = await em.findAll(AuditLogWithoutUser);
  console.log(JSON.stringify(logs, null, 2));
  for (const log of logs) {
    console.log(log.changeType);
    console.log(log.entityName, log.entityId, "prev:", log.changes.prev());
    console.log(log.entityName, log.entityId, "next:", log.changes.next());
  }
  process.exit(0);
}


main().catch((err) => {
  console.error(err);
  process.exit(1);
})
