"use client";

import type { LedgerEntryCategory, LedgerEntryType } from "@prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { createLedgerEntryAction } from "@/src/actions/financial-ledger.actions";
import { productOptions } from "@/src/lib/constants/prospect-options";
import {
  getProductRequirementForCategory,
  inflowCategoryOptions,
  outflowCategoryOptions,
  paymentMethodOptions,
} from "@/src/lib/financial-ledger-options";
import {
  financialLedgerEntrySchema,
  type LedgerEntryFormInput,
  type ValidatedLedgerEntryInput,
} from "@/src/lib/validations/financial-ledger.schema";

type LedgerEntryFormProps = {
  type: LedgerEntryType;
};

const fieldClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";
const textAreaClassName =
  "w-full min-h-32 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * One shared form for both directions (Ticket 17B): `type` comes from the
 * trusted route/query configuration, not user input, and drives which
 * category set and counterparty label are shown. The server schema stays
 * authoritative for everything validated here.
 */
export default function LedgerEntryForm({ type }: LedgerEntryFormProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);

  const categoryOptions =
    type === "INFLOW" ? inflowCategoryOptions : outflowCategoryOptions;
  const counterpartyLabel = type === "INFLOW" ? "Reçu de" : "Payé à";
  const counterpartyPlaceholder =
    type === "INFLOW" ? "Ex : Groupe scolaire Horizon" : "Ex : Julbert Serme";

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LedgerEntryFormInput, unknown, ValidatedLedgerEntryInput>({
    resolver: zodResolver(financialLedgerEntrySchema),
    defaultValues: {
      type,
      category: "",
      amount: "",
      currencyCode: "XOF",
      counterpartyName: "",
      reason: "",
      paymentMethod: "",
      reference: "",
      occurredAt: todayIsoDate(),
    },
  });

  const category = useWatch({ control, name: "category" }) as
    | LedgerEntryCategory
    | "";
  const productRequirement = category
    ? getProductRequirementForCategory(category)
    : "forbidden";

  useEffect(() => {
    if (productRequirement === "forbidden") {
      setValue("product", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productRequirement]);

  async function onSubmit(values: ValidatedLedgerEntryInput) {
    setFeedback(null);

    const result = await createLedgerEntryAction(values);

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages?.[0];
          if (message) {
            setError(field as keyof LedgerEntryFormInput, {
              type: "server",
              message,
            });
          }
        }
      }

      setFeedback(result.message);
      return;
    }

    const flash = type === "INFLOW" ? "inflow" : "outflow";
    router.push(`/finances?created=${flash}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <FormField label="Montant (CFA)" error={errors.amount?.message as string}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Ex : 150000"
          className={fieldClassName}
          {...register("amount")}
        />
      </FormField>

      <FormField label="Catégorie" error={errors.category?.message}>
        <select className={fieldClassName} {...register("category")}>
          <option value="">Choisir une catégorie</option>
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>

      {productRequirement !== "forbidden" && (
        <FormField
          label={
            productRequirement === "required" ? "Produit *" : "Produit concerné"
          }
          error={errors.product?.message as string}
        >
          <select className={fieldClassName} {...register("product")}>
            <option value="">
              {productRequirement === "required"
                ? "Choisir un produit"
                : "Aucun produit concerné"}
            </option>
            {productOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
      )}

      <FormField label={counterpartyLabel} error={errors.counterpartyName?.message}>
        <input
          type="text"
          placeholder={counterpartyPlaceholder}
          className={fieldClassName}
          {...register("counterpartyName")}
        />
      </FormField>

      <FormField label="Mode de paiement" error={errors.paymentMethod?.message}>
        <select className={fieldClassName} {...register("paymentMethod")}>
          <option value="">Choisir un moyen de paiement</option>
          {paymentMethodOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Date du mouvement" error={errors.occurredAt?.message as string}>
        <input
          type="date"
          className={fieldClassName}
          {...register("occurredAt")}
        />
      </FormField>

      <FormField label="Motif" error={errors.reason?.message}>
        <textarea
          rows={4}
          placeholder="Ex : Premier versement annuel KARMDA"
          className={textAreaClassName}
          {...register("reason")}
        />
      </FormField>

      <FormField
        label="Référence"
        error={errors.reference?.message as string}
        optional
      >
        <input
          type="text"
          placeholder="N° facture, transaction Mobile Money, reçu, référence bancaire..."
          className={fieldClassName}
          {...register("reference")}
        />
      </FormField>

      {feedback && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {feedback}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => router.push("/finances")}
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
            : type === "INFLOW"
              ? "Enregistrer l’entrée"
              : "Enregistrer la sortie"}
        </button>
      </div>
    </form>
  );
}

function FormField({
  label,
  error,
  optional,
  children,
}: {
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {optional && (
          <span className="ml-1 font-normal text-slate-400">(optionnel)</span>
        )}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
