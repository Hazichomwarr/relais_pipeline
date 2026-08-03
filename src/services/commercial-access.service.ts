import "server-only";

import { prisma } from "@/src/lib/prisma";
import { assertCommercialAccessCore } from "@/src/services/commercial-access.service-core";

export function assertCommercialAccess(userId: string) {
  return assertCommercialAccessCore(userId, (validatedUserId) =>
    prisma.user.findUnique({
      where: { id: validatedUserId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        active: true,
      },
    }),
  );
}
