"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/src/actions/authorize-action";
import { prospectActivitySchema } from "@/src/lib/validations/prospect-activity.schema";
import { createProspectActivity } from "@/src/services/prospect-activity.service";
import { requireRole } from "@/src/services/authorization.service";

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
  const authorization = await authorizeAction(() =>
    requireRole("ADMIN", "MANAGER"),
  );

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

  const result = await createProspectActivity(parsed.data, authorization.user);

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
