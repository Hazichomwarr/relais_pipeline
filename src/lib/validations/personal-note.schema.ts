import { z } from "zod";

export const personalNoteCategories = [
  "URGENT_TODO",
  "COMMERCIAL_DEBRIEF",
  "RELAIS_IDEA",
  "SCHOOL_DOCUMENTS",
  "OTHER",
] as const;

const optionalContent = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();
  return normalized || undefined;
}, z.string().max(10000, "Le contenu de la note est trop long.").optional());

/**
 * Never accepts userId — note ownership comes only from the authenticated
 * session (see requireAuthenticatedUser() in the service/action layer).
 */
export const personalNoteSchema = z.object({
  category: z
    .string()
    .min(1, "Sélectionnez une catégorie de note.")
    .pipe(
      z.enum(personalNoteCategories, {
        error: "Sélectionnez une catégorie de note.",
      }),
    ),
  title: z
    .string()
    .trim()
    .min(2, "Le titre de la note est requis.")
    .max(180, "Le titre de la note est trop long."),
  content: optionalContent,
  pinned: z.boolean().default(false),
});

export const personalNoteUpdateSchema = personalNoteSchema.extend({
  noteId: z.string().trim().min(1, "La note est requise.").max(100),
});

export const personalNoteDeleteSchema = z.object({
  noteId: z.string().trim().min(1, "La note est requise.").max(100),
});

export type PersonalNoteFormInput = z.input<typeof personalNoteSchema>;
export type ValidatedPersonalNoteInput = z.output<typeof personalNoteSchema>;
export type PersonalNoteUpdateInput = z.input<typeof personalNoteUpdateSchema>;
export type ValidatedPersonalNoteUpdateInput = z.output<
  typeof personalNoteUpdateSchema
>;
export type ValidatedPersonalNoteDeleteInput = z.output<
  typeof personalNoteDeleteSchema
>;
