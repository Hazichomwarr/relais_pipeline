import "server-only";

import { getFollowUpQueue } from "@/src/services/follow-up.service";
import { assertCommercialAccess } from "@/src/services/commercial-access.service";

export async function getCommercialFollowUpQueue(
  userId: string,
  today = new Date(),
) {
  const commercial = await assertCommercialAccess(userId);
  return getFollowUpQueue({ userId: commercial.id }, today);
}

export type CommercialFollowUpItem = Awaited<
  ReturnType<typeof getCommercialFollowUpQueue>
>[number];
