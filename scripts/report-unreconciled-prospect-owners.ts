import "dotenv/config";

import { prisma } from "@/src/lib/prisma";

async function main() {
  const [ownershipGroups, totalProspects, invalidLinkedRoles] =
    await Promise.all([
      prisma.prospect.groupBy({
        by: ["agentName", "assignedUserId"],
        _count: { _all: true },
        orderBy: [{ agentName: "asc" }, { assignedUserId: "asc" }],
      }),
      prisma.prospect.count(),
      prisma.prospect.count({
        where: {
          assignedUser: {
            is: { role: { not: "COMMERCIAL" } },
          },
        },
      }),
    ]);
  const assignedUserIds = [
    ...new Set(
      ownershipGroups.flatMap((group) =>
        group.assignedUserId ? [group.assignedUserId] : [],
      ),
    ),
  ];
  const assignedUsers = await prisma.user.findMany({
    where: { id: { in: assignedUserIds } },
    select: { id: true, firstName: true, lastName: true, active: true },
  });
  const usersById = new Map(assignedUsers.map((user) => [user.id, user]));

  console.table(
    ownershipGroups.map((group) => {
      const assignedUser = group.assignedUserId
        ? usersById.get(group.assignedUserId)
        : undefined;

      return {
        agentName: group.agentName,
        prospects: group._count._all,
        assignedUser: assignedUser
          ? `${assignedUser.firstName} ${assignedUser.lastName}${
              assignedUser.active ? "" : " (inactive)"
            }`
          : "—",
        status: group.assignedUserId ? "reconciled" : "unresolved",
      };
    }),
  );

  const unresolvedCount = ownershipGroups
    .filter((group) => group.assignedUserId === null)
    .reduce((total, group) => total + group._count._all, 0);

  console.log(`Unresolved prospects: ${unresolvedCount}`);
  console.log(`Total prospects preserved: ${totalProspects}`);
  console.log(`Prospects linked to a non-commercial User: ${invalidLinkedRoles}`);
}

main()
  .catch((error) => {
    console.error("Unable to produce the ownership report:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
