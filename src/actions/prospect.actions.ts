"use server";

import { revalidatePath } from "next/cache";

import { prospectSchema } from "@/src/lib/validations/prospect.schema";
import { createProspect } from "@/src/services/prospect.service";

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
