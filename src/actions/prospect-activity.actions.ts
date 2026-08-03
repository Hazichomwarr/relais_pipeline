"use server";

import { revalidatePath } from "next/cache";

import { prospectActivitySchema } from "@/src/lib/validations/prospect-activity.schema";
import { createProspectActivity } from "@/src/services/prospect-activity.service";

export type CreateProspectActivityActionResult =
  | {
      success: true;
      activityId: string;
    }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export async function createProspectActivityAction(
  values: unknown,
): Promise<CreateProspectActivityActionResult> {
  const parsed = prospectActivitySchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations de l’interaction sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await createProspectActivity(parsed.data);

  if (!result.success) {
    return {
      success: false,
      message: result.message,
    };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/prospects/${parsed.data.prospectId}`);

  return result;
}
