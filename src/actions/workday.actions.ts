"use server";

import { authorizeAction } from "@/src/actions/authorize-action";
import { confirmWorkdayStartSchema } from "@/src/lib/validations/workday.schema";
import { resolveWorkDate } from "@/src/lib/workday-date";
import {
  requireWorkdayConfirmationAccess,
  requireWorkdayEligibility,
} from "@/src/services/authorization.service";
import {
  confirmWorkdayStartFor,
  endMyWorkday,
  startMyWorkday,
} from "@/src/services/workday.service";
import type {
  ConfirmWorkdayStartResult,
  EndWorkdayResult,
  StartWorkdayResult,
} from "@/src/services/workday.service-core";

/**
 * Ticket 27C §41 — self actions accept no identity from the caller;
 * `authorization.user.id` (resolved server-side from the session, never
 * client input) is the only actor identity these two ever use. Mirrors
 * the established personal-note.actions.ts pattern.
 */
export async function startMyWorkdayAction(): Promise<
  StartWorkdayResult | { success: false; message: string }
> {
  const authorization = await authorizeAction(() => requireWorkdayEligibility());

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  return startMyWorkday(authorization.user.id);
}

export async function endMyWorkdayAction(): Promise<
  EndWorkdayResult | { success: false; message: string }
> {
  const authorization = await authorizeAction(() => requireWorkdayEligibility());

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  return endMyWorkday(authorization.user.id);
}

/**
 * Ticket 27C §24/§41 — this IS an other-person action, so the subject
 * (`employeeUserId` + `workDate`) is explicit input, unlike the two
 * actions above. `confirmWorkdayStartFor` independently re-verifies
 * authority against the real, freshly-resolved subject — this action
 * never trusts the coarse route gate alone.
 */
export async function confirmWorkdayStartAction(
  values: unknown,
): Promise<
  | ConfirmWorkdayStartResult
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    }
> {
  const authorization = await authorizeAction(() =>
    requireWorkdayConfirmationAccess(),
  );

  if (!authorization.ok) {
    return { success: false, message: authorization.message };
  }

  const parsed = confirmWorkdayStartSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      message: "Certaines informations de confirmation sont invalides.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  return confirmWorkdayStartFor(authorization.user.id, {
    employeeUserId: parsed.data.employeeUserId,
    workDate: resolveWorkDate(parsed.data.workDate),
  });
}
