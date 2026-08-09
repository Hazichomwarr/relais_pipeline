"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "@prisma/client";
import { CheckCircle2, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  createUserAction,
  deactivateUserAction,
  updateUserAction,
} from "@/src/actions/user.actions";
import { dailyReportTemplateTypeOptions } from "@/src/lib/constants/daily-report-options";
import { userRoleOptions } from "@/src/lib/constants/user-options";
import {
  userSchema,
  type UserFormInput,
  type ValidatedUserInput,
} from "@/src/lib/validations/user.schema";

import UserTable from "./user-table";

type UserManagementProps = {
  users: User[];
};

type Feedback = {
  type: "success" | "error";
  message: string;
};

export default function UserManagement({ users }: UserManagementProps) {
  const router = useRouter();
  const [dialogState, setDialogState] = useState<
    { mode: "create" } | { mode: "edit"; user: User } | null
  >(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [deactivatingUserId, setDeactivatingUserId] = useState<string>();

  function openCreateDialog() {
    setFeedback(null);
    setDialogState({ mode: "create" });
  }

  function openEditDialog(user: User) {
    setFeedback(null);
    setDialogState({ mode: "edit", user });
  }

  async function handleDeactivate(user: User) {
    const confirmed = window.confirm(
      `Désactiver ${user.firstName} ${user.lastName} ? Son historique restera disponible.`,
    );

    if (!confirmed) {
      return;
    }

    setFeedback(null);
    setDeactivatingUserId(user.id);
    const result = await deactivateUserAction({ userId: user.id });
    setDeactivatingUserId(undefined);

    if (!result.success) {
      setFeedback({ type: "error", message: result.message });
      return;
    }

    setFeedback({
      type: "success",
      message: `${user.firstName} ${user.lastName} a été désactivé.`,
    });
    router.refresh();
  }

  function handleSaved(message: string) {
    setDialogState(null);
    setFeedback({ type: "success", message });
    router.refresh();
  }

  return (
    <>
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={openCreateDialog}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0f2557] px-5 font-semibold text-white transition hover:bg-[#18366f]"
        >
          <UserPlus className="h-4 w-4" />
          Ajouter un utilisateur
        </button>
      </div>

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`mb-6 flex items-start justify-between gap-4 rounded-2xl border px-5 py-4 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <span className="flex items-start gap-2">
            {feedback.type === "success" && (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            {feedback.message}
          </span>
          <button
            type="button"
            aria-label="Fermer le message"
            onClick={() => setFeedback(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <UserTable
        users={users}
        deactivatingUserId={deactivatingUserId}
        onCreate={openCreateDialog}
        onEdit={openEditDialog}
        onDeactivate={handleDeactivate}
      />

      {dialogState && (
        <UserDialog
          user={dialogState.mode === "edit" ? dialogState.user : undefined}
          onClose={() => setDialogState(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}

type UserDialogProps = {
  user?: User;
  onClose: () => void;
  onSaved: (message: string) => void;
};

function UserDialog({ user, onClose, onSaved }: UserDialogProps) {
  const [serverError, setServerError] = useState<string>();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UserFormInput, unknown, ValidatedUserInput>({
    resolver: zodResolver(userSchema),
    defaultValues: getDefaultValues(user),
  });

  useEffect(() => {
    reset(getDefaultValues(user));
  }, [reset, user]);

  async function onSubmit(values: ValidatedUserInput) {
    setServerError(undefined);
    const result = user
      ? await updateUserAction({ ...values, userId: user.id })
      : await createUserAction(values);

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages?.[0];
          if (message) {
            setError(field as keyof UserFormInput, {
              type: "server",
              message,
            });
          }
        }
      }
      setServerError(result.message);
      return;
    }

    onSaved(
      user
        ? "L’utilisateur a été mis à jour."
        : "L’utilisateur a été créé.",
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-dialog-title"
      className="safe-top safe-bottom fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-8 backdrop-blur-sm"
    >
      <section className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-4xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-5 border-b border-slate-100 px-6 py-6 md:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
              Fondation utilisateurs
            </p>
            <h2
              id="user-dialog-title"
              className="mt-2 text-2xl font-bold text-[#0f2557]"
            >
              {user ? "Modifier l’utilisateur" : "Créer un utilisateur"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fermer"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-5 px-6 py-7 md:px-8"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Prénom" error={errors.firstName?.message}>
              <input
                type="text"
                className={inputClassName}
                {...register("firstName")}
              />
            </FormField>
            <FormField label="Nom" error={errors.lastName?.message}>
              <input
                type="text"
                className={inputClassName}
                {...register("lastName")}
              />
            </FormField>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Téléphone" error={errors.phone?.message}>
              <input
                type="tel"
                placeholder="Optionnel"
                className={inputClassName}
                {...register("phone")}
              />
            </FormField>
            <FormField label="E-mail" error={errors.email?.message}>
              <input
                type="email"
                placeholder="Optionnel"
                className={inputClassName}
                {...register("email")}
              />
            </FormField>
          </div>

          <FormField label="Rôle" error={errors.role?.message}>
            <select className={inputClassName} {...register("role")}>
              <option value="">Sélectionnez un rôle</option>
              {userRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Modèle de rapport quotidien"
            error={errors.dailyReportTemplateType?.message}
          >
            <select
              className={inputClassName}
              {...register("dailyReportTemplateType")}
            >
              <option value="">Aucun rapport quotidien</option>
              {dailyReportTemplateTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          {user && (
            <label className="flex items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <span>
                <span className="block font-semibold text-slate-800">
                  Utilisateur actif
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Un utilisateur inactif reste visible dans l’historique.
                </span>
              </span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#0f2557]"
                {...register("active")}
              />
            </label>
          )}

          {serverError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {serverError}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-12 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-12 rounded-xl bg-[#0f2557] px-6 font-semibold text-white transition hover:bg-[#18366f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Enregistrement..."
                : user
                  ? "Enregistrer les modifications"
                  : "Créer l’utilisateur"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

const inputClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

function getDefaultValues(user?: User): UserFormInput {
  return {
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    phone: user?.phone ?? "",
    email: user?.email ?? "",
    role: user?.role ?? "",
    active: user?.active ?? true,
    dailyReportTemplateType: user?.dailyReportTemplateType ?? "",
  };
}
