"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/src/actions/authorize-action";
import { prospectFollowUpWorkflowSchema } from "@/src/lib/validations/prospect-follow-up.schema";
import { submitProspectFollowUp } from "@/src/services/prospect-follow-up.service";
import { requireAuthenticatedUser } from "@/src/services/authorization.service";

export type SubmitProspectFollowUpActionResult =
  | { success: true }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

/**
 * Role-neutral at the authentication layer, like createProspectActionAction
 * (Ticket 20B) and createProspectAction (Ticket 15H.1) — ownership scoping
 * for which prospect may be followed up on happens inside the service,
 * keyed off authorization.user.role, never off client input.
 */
export async function submitProspectFollowUpAction(
  values: unknown,
): Promise<SubmitProspectFollowUpActionResult> {
  const authorization = await authorizeAction(() => requireAuthenticatedUser());

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = prospectFollowUpWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations du suivi sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await submitProspectFollowUp(authorization.user, parsed.data);

  if (!result.success) {
    return { success: false, message: result.message };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/follow-ups");
  revalidatePath(`/admin/prospects/${parsed.data.prospectId}`);
  revalidatePath("/dashboard/commercial");
  revalidatePath(`/dashboard/commercial/prospects/${parsed.data.prospectId}`);

  return { success: true };
}
