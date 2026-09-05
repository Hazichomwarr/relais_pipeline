"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/src/actions/authorize-action";
import { reassignProspectSchema } from "@/src/lib/validations/prospect-assignment-transfer.schema";
import { reassignProspect } from "@/src/services/prospect-assignment-transfer.service";
import type { ReassignProspectErrorCode } from "@/src/services/prospect-assignment-transfer.service-core";
import { requireProspectReassignmentAccess } from "@/src/services/authorization.service";

export type ReassignProspectActionResult =
  | { success: true }
  | {
      success: false;
      message: string;
      /**
       * Ticket 28C — the domain code behind `message`, when the failure
       * came from reassignProspectCore itself (never set for an
       * authorization/validation failure caught earlier in this action).
       * Lets the UI branch on specific outcomes (e.g. CONCURRENTLY_REASSIGNED
       * needs a refresh-and-don't-retry treatment, TARGET_INACTIVE needs a
       * picker refresh) without parsing message text.
       */
      code?: ReassignProspectErrorCode;
      fieldErrors?: Record<string, string[] | undefined>;
    };

/**
 * Ticket 28B §23 — accepts only prospectId/newAssignedUserId/reason. No
 * fromUserId, changedByUserId, actorRole, or occurredAt field exists on
 * `reassignProspectSchema` for a crafted request to supply — every
 * authoritative fact is derived server-side, starting with the actor
 * (authorization.user.id, never client input) resolved fresh again inside
 * reassignProspectCore (28A §13). No management UI consumes this in 28B —
 * 28C builds it.
 */
export async function reassignProspectAction(
  values: unknown,
): Promise<ReassignProspectActionResult> {
  const authorization = await authorizeAction(() =>
    requireProspectReassignmentAccess(),
  );

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = reassignProspectSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations de la réaffectation sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await reassignProspect(authorization.user.id, parsed.data);

  if (!result.success) {
    return { success: false, message: result.message, code: result.code };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/my-prospects");
  revalidatePath("/admin/follow-ups");
  revalidatePath(`/admin/prospects/${parsed.data.prospectId}`);
  revalidatePath("/dashboard/commercial");
  revalidatePath(`/dashboard/commercial/prospects/${parsed.data.prospectId}`);

  return { success: true };
}
