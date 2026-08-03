"use server";

import { revalidatePath } from "next/cache";

import {
  prospectFollowUpSchema,
  prospectSchema,
} from "@/src/lib/validations/prospect.schema";
import {
  createProspect,
  updateProspectFollowUp,
} from "@/src/services/prospect.service";

export type CreateProspectActionResult =
  | {
      success: true;
      prospectId: string;
    }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export async function createProspectAction(
  values: unknown,
): Promise<CreateProspectActionResult> {
  const parsed = prospectSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await createProspect(parsed.data);

  if (!result.success) {
    return {
      success: false,
      message: result.message,
    };
  }

  revalidatePath("/admin");

  return result;
}

export type UpdateProspectFollowUpActionResult =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export async function updateProspectFollowUpAction(
  values: unknown,
): Promise<UpdateProspectFollowUpActionResult> {
  const parsed = prospectFollowUpSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations de suivi sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await updateProspectFollowUp(parsed.data);

  if (!result.success) {
    return {
      success: false,
      message: result.message,
    };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/prospects/${parsed.data.prospectId}`);

  return {
    success: true,
    message: "Le suivi du prospect a été mis à jour.",
  };
}
