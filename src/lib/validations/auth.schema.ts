import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "L’adresse e-mail est requise.")
    .email("Saisissez une adresse e-mail valide."),
  password: z.string().min(1, "Le mot de passe est requis."),
});

export const newPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères."),
});

export const changePasswordSchema = newPasswordSchema.extend({
  userId: z.string().trim().min(1, "L’utilisateur est requis."),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
