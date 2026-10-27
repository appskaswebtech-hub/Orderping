import { PrismaClient } from "@prisma/support-client";

if (process.env.NODE_ENV !== "production") {
  if (!global.supportPrismaGlobal) {
    global.supportPrismaGlobal = new PrismaClient();
  }
}

const supportPrisma = global.supportPrismaGlobal ?? new PrismaClient();

export default supportPrisma;
