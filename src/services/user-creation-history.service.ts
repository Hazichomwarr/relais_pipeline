import "server-only";

import type { DailyReportTemplateType, UserRole } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";

export type UserCreationData = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  passwordHash?: string | null;
  role: UserRole;
  active?: boolean;
  dailyReportTemplateType?: DailyReportTemplateType | null;
};

/**
 * The authoritative persistence boundary for authenticated user creation.
 * The actor is supplied by the already-authorized server boundary, never by
 * browser input. UserCreationActivity.subjectUserId is unique, so the database
 * also guarantees that a subject cannot acquire two CREATED facts.
 */
export async function createUserWithCreationHistory(
  data: UserCreationData,
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data,
      select: { id: true, role: true },
    });

    await transaction.userCreationActivity.create({
      data: {
        subjectUserId: user.id,
        actorUserId,
        roleAtEvent: user.role,
      },
      select: { id: true },
    });

    return { id: user.id };
  });
}
