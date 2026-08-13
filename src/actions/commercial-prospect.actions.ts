"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/src/actions/authorize-action";
import type { CreateProspectActivityActionResult } from "@/src/actions/prospect-activity.actions";
import { prospectActivitySchema } from "@/src/lib/validations/prospect-activity.schema";
import { requireCommercial } from "@/src/services/authorization.service";
import { createCommercialActivity } from "@/src/services/commercial-prospect.service";

export async function createCommercialActivityAction(
  values: unknown,
): Promise<CreateProspectActivityActionResult> {
  const authorization = await authorizeAction(requireCommercial);

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = prospectActivitySchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations de l’interaction sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await createCommercialActivity(
    authorization.user.id,
    parsed.data,
  );

  if (!result.success) {
    return {
      success: false,
      message: result.message,
    };
  }

  revalidatePath("/dashboard/commercial");
  revalidatePath(`/dashboard/commercial/prospects/${parsed.data.prospectId}`);

  return result;
}
