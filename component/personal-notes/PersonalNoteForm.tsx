"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  createPersonalNoteAction,
  updatePersonalNoteAction,
} from "@/src/actions/personal-note.actions";
import { personalNoteCategoryOptions } from "@/src/lib/personal-note-options";
import {
  personalNoteSchema,
  type PersonalNoteFormInput,
  type ValidatedPersonalNoteInput,
} from "@/src/lib/validations/personal-note.schema";

type PersonalNoteFormProps =
  | { mode: "create" }
  | {
      mode: "edit";
      noteId: string;
      defaultValues: {
        category: PersonalNoteFormInput["category"];
        title: string;
        content: string;
        pinned: boolean;
      };
    };

const fieldClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";
const textAreaClassName =
  "w-full min-h-40 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

export default function PersonalNoteForm(props: PersonalNoteFormProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PersonalNoteFormInput, unknown, ValidatedPersonalNoteInput>({
    resolver: zodResolver(personalNoteSchema),
    defaultValues: getDefaultValues(props),
  });

  useEffect(() => {
    reset(getDefaultValues(props));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode === "edit" ? props.noteId : undefined, reset]);

  async function onSubmit(values: ValidatedPersonalNoteInput) {
    setFeedback(null);

    const result =
      props.mode === "edit"
        ? await updatePersonalNoteAction({ ...values, noteId: props.noteId })
        : await createPersonalNoteAction(values);

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages?.[0];
          if (message) {
            setError(field as keyof PersonalNoteFormInput, {
              type: "server",
              message,
            });
          }
        }
      }

      setFeedback({ type: "error", message: result.message });
      return;
    }

    if (props.mode === "create") {
      router.push(`/notes/${result.noteId}`);
      return;
    }

    setFeedback({ type: "success", message: "La note a été mise à jour." });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <FormField label="Catégorie" error={errors.category?.message}>
        <select className={fieldClassName} {...register("category")}>
          <option value="">Choisir une catégorie</option>
          {personalNoteCategoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Titre" error={errors.title?.message}>
        <input
          type="text"
          placeholder="Ex : Préparer le débrief de vendredi"
          className={fieldClassName}
          {...register("title")}
        />
      </FormField>

      <FormField label="Contenu" error={errors.content?.message}>
        <textarea
          rows={6}
          placeholder="Ajoutez les détails, les idées ou les éléments à ne pas oublier..."
          className={textAreaClassName}
          {...register("content")}
        />
      </FormField>

      <label className="flex items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
        <span>
          <span className="block font-semibold text-slate-800">
            Épingler cette note
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            Les notes épinglées apparaissent en premier.
          </span>
        </span>
        <input
          type="checkbox"
          className="h-5 w-5 accent-[#0f2557]"
          {...register("pinned")}
        />
      </label>

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <div className="flex items-start gap-2">
            {feedback.type === "success" && (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => router.push("/notes")}
          disabled={isSubmitting}
          className="h-12 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0f2557] px-6 font-semibold text-white transition hover:bg-[#18366f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isSubmitting
            ? "Enregistrement..."
            : props.mode === "edit"
              ? "Enregistrer les modifications"
              : "Créer la note"}
        </button>
      </div>
    </form>
  );
}

function getDefaultValues(props: PersonalNoteFormProps): PersonalNoteFormInput {
  if (props.mode === "edit") {
    return {
      category: props.defaultValues.category,
      title: props.defaultValues.title,
      content: props.defaultValues.content,
      pinned: props.defaultValues.pinned,
    };
  }

  return {
    category: "",
    title: "",
    content: "",
    pinned: false,
  };
}

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
