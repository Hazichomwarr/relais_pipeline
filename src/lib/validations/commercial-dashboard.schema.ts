import { z } from "zod";

export const commercialDashboardSchema = z.object({
  userId: z
    .string({ error: "L’identifiant du commercial est requis." })
    .trim()
    .min(1, "L’identifiant du commercial est requis."),
});

export type ValidatedCommercialDashboardInput = z.output<
  typeof commercialDashboardSchema
>;
