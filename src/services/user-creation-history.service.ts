import "server-only";

import type { DailyReportTemplateType, UserRole } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";
import { resolveRelaisOrganizationId } from "@/src/services/organization-bootstrap.service";

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
 *
 * Ticket 26B §44/§46: also creates the new user's RELAIS
 * OrganizationMembership in the same transaction, so a User can never exist
 * without a membership — a rollback of any step rolls back all three
 * inserts together. membership.role is a transitional shadow copy of
 * User.role; User.role remains runtime authorization authority (see
 * notes/ticket-26b-organization-membership-foundation.md).
 */
export async function createUserWithCreationHistory(
  data: UserCreationData,
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const organizationId = await resolveRelaisOrganizationId(transaction);

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

    await transaction.organizationMembership.create({
      data: {
        organizationId,
        userId: user.id,
        role: user.role,
      },
      select: { id: true },
    });

    return { id: user.id };
  });
}
