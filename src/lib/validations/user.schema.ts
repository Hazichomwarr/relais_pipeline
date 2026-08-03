import { z } from "zod";

export const userRoles = ["ADMIN", "COMMERCIAL", "MANAGER"] as const;

const optionalEmail = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim().toLowerCase();
    return normalized || null;
  },
  z
    .string()
    .email("Saisissez une adresse e-mail valide.")
    .max(254, "L’adresse e-mail est trop longue.")
    .nullable(),
);

const optionalPhone = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim();
    return normalized || null;
  },
  z
    .string()
    .min(8, "Le numéro de téléphone doit contenir au moins 8 caractères.")
    .max(30, "Le numéro de téléphone est trop long.")
    .nullable(),
);

export const userSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "Le prénom est requis.")
    .max(100, "Le prénom est trop long."),
  lastName: z
    .string()
    .trim()
    .min(2, "Le nom est requis.")
    .max(100, "Le nom est trop long."),
  email: optionalEmail,
  phone: optionalPhone,
  role: z
    .string()
    .min(1, "Sélectionnez un rôle.")
    .pipe(z.enum(userRoles, { error: "Sélectionnez un rôle valide." })),
  active: z.boolean().default(true),
});

export const userUpdateSchema = userSchema.extend({
  userId: z.string().trim().min(1, "L’utilisateur est requis.").max(100),
});

export const deactivateUserSchema = z.object({
  userId: z.string().trim().min(1, "L’utilisateur est requis.").max(100),
});

export type UserFormInput = z.input<typeof userSchema>;
export type ValidatedUserInput = z.output<typeof userSchema>;
export type UserUpdateInput = z.input<typeof userUpdateSchema>;
export type ValidatedUserUpdateInput = z.output<typeof userUpdateSchema>;
