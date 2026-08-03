import "dotenv/config";

import { prisma } from "@/src/lib/prisma";
import { reconcileProspectOwners } from "@/src/services/prospect-owner-reconciliation";

import { prospectOwnerMappings } from "./prospect-owner-mappings";

async function main() {
  if (process.env.CONFIRM_PROSPECT_OWNER_RECONCILIATION !== "YES") {
    throw new Error(
      "Refusing to reconcile. Set CONFIRM_PROSPECT_OWNER_RECONCILIATION=YES after reviewing the map and creating a Neon restore point.",
    );
  }

  if (prospectOwnerMappings.length === 0) {
    throw new Error(
      "Refusing to reconcile because the reviewed mapping is empty.",
    );
  }

  const results = await reconcileProspectOwners(prospectOwnerMappings, {
    runTransaction: (work) =>
      prisma.$transaction((transaction) =>
        work({
          findUsersByIds: (userIds) =>
            transaction.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, role: true },
            }),
          countUnassigned: (historicalAgentNames) =>
            transaction.prospect.count({
              where: {
                assignedUserId: null,
                agentName: { in: historicalAgentNames },
              },
            }),
          assignUnassigned: async (userId, historicalAgentNames) => {
            const update = await transaction.prospect.updateMany({
              where: {
                assignedUserId: null,
                agentName: { in: historicalAgentNames },
              },
              data: { assignedUserId: userId },
            });
            return update.count;
          },
        }),
      ),
  });

  for (const result of results) {
    console.log(
      `User ${result.userId}: matched ${result.matched}, updated ${result.updated}, exact names: ${result.historicalAgentNames.join(
        " | ",
      )}`,
    );
  }

  const unresolved = await prisma.prospect.groupBy({
    by: ["agentName"],
    where: { assignedUserId: null },
    _count: { _all: true },
    orderBy: { agentName: "asc" },
  });

  console.table(
    unresolved.map((group) => ({
      agentName: group.agentName,
      prospects: group._count._all,
      status: "unresolved",
    })),
  );
}

main()
  .catch((error) => {
    console.error("Prospect-owner reconciliation failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
