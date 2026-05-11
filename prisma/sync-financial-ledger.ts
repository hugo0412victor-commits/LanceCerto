import { PrismaClient } from "@prisma/client";
import { syncFinancialLedgerFromLegacy } from "../lib/financial-ledger";

const prisma = new PrismaClient();

async function main() {
  const result = await syncFinancialLedgerFromLegacy(prisma);
  // eslint-disable-next-line no-console
  console.log(`Financial ledger synchronized. Entries touched: ${result.syncedEntries}.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
