"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/src/actions/authorize-action";
import type { UpdateProspectFollowUpActionResult } from "@/src/actions/prospect.actions";
import type { CreateProspectActivityActionResult } from "@/src/actions/prospect-activity.actions";
import { prospectActivitySchema } from "@/src/lib/validations/prospect-activity.schema";
import { prospectFollowUpSchema } from "@/src/lib/validations/prospect.schema";
import { requireCommercial } from "@/src/services/authorization.service";
import {
  createCommercialActivity,
  updateCommercialProspect,
} from "@/src/services/commercial-prospect.service";

export async function updateCommercialProspectFollowUpAction(
  values: unknown,
): Promise<UpdateProspectFollowUpActionResult> {
  const authorization = await authorizeAction(requireCommercial);

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = prospectFollowUpSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations de suivi sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await updateCommercialProspect(
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

  return {
    success: true,
    message: "Le suivi du prospect a été mis à jour.",
  };
}

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
