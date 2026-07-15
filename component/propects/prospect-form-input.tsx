"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Send, ShieldCheck, X } from "lucide-react";
import Image from "next/image";
import { useForm, useWatch } from "react-hook-form";

import { createProspectAction } from "@/src/actions/prospect.actions";
import {
  prospectSchema,
  type ProspectFormInput,
  type ValidatedProspectInput,
} from "@/src/lib/validations/prospect.schema";

import { DigitalServiceFields } from "./DigitalServiceFields";
import { KarmdaFields } from "./KarmdaFields";
import { LokariFields } from "./LokariFields";
import { NiaFields } from "./NiaFields";
import { SharedProspectFields } from "./shared-fields";

const defaultValues: ProspectFormInput = {
  product: "",
  name: "",
  prospectType: "",
  contactName: "",
  phone: "",
  location: "",
  interest: "",
  status: "NEW",
  onlinePresence: undefined,
  nextAction: undefined,
  followUpDate: "",
  notes: "",
  agentName: "",

  schoolType: "",
  estimatedStudentCount: undefined,
  currentSchoolSystem: "",
  contactRole: "",

  propertyOwnerType: "",
  estimatedPropertyCount: undefined,
  propertyCountries: "",
  currentPropertySystem: "",

  savingsGroupType: "",
  estimatedMemberCount: undefined,
  contributionFrequency: "",
  currentSavingsSystem: "",

  businessCategory: "",
  requestedService: "",
};

export default function ProspectForm() {
  const [showSuccess, setShowSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    resetField,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProspectFormInput, unknown, ValidatedProspectInput>({
    resolver: zodResolver(prospectSchema),
    defaultValues,
  });

  const selectedProduct = useWatch({ control, name: "product" });

  useEffect(() => {
    if (selectedProduct !== "KARMDA") {
      resetField("schoolType");
      resetField("estimatedStudentCount");
      resetField("currentSchoolSystem");
      resetField("contactRole");
    }

    if (selectedProduct !== "LOKARI") {
      resetField("propertyOwnerType");
      resetField("estimatedPropertyCount");
      resetField("propertyCountries");
      resetField("currentPropertySystem");
    }

    if (selectedProduct !== "NIA") {
      resetField("savingsGroupType");
      resetField("estimatedMemberCount");
      resetField("contributionFrequency");
      resetField("currentSavingsSystem");
    }

    if (selectedProduct !== "DIGITAL_SERVICES") {
      resetField("businessCategory");
      resetField("requestedService");
    }
  }, [selectedProduct, resetField]);

  async function onSubmit(values: ValidatedProspectInput) {
    setServerError(null);

    const result = await createProspectAction(values);

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages?.[0];

          if (!message) {
            continue;
          }

          setError(field as keyof ProspectFormInput, {
            type: "server",
            message,
          });
        }
      }

      setServerError(result.message);
      return;
    }

    reset(defaultValues);
    setShowSuccess(true);

    window.setTimeout(() => {
      setShowSuccess(false);
    }, 3500);
  }

  return (
    <section className="min-h-screen bg-[#f5f7fb] px-4 py-12">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-4xl border border-slate-100 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
        <header className="border-b border-slate-100 px-6 py-9 text-center md:px-10">
          <div className="mb-5 flex justify-center">
            <Image
              src="/images/logo.png"
              alt="RELAIS"
              width={90}
              height={60}
              priority
              className="h-auto w-auto object-contain"
            />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
            Nouveau prospect
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-slate-500">
            Enregistrez les informations recueillies pendant la prospection
            terrain.
          </p>
        </header>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-8 px-6 py-9 md:px-10"
        >
          <SharedProspectFields register={register} errors={errors} />

          {selectedProduct === "KARMDA" && (
            <KarmdaFields register={register} errors={errors} />
          )}

          {selectedProduct === "LOKARI" && (
            <LokariFields register={register} errors={errors} />
          )}

          {selectedProduct === "NIA" && (
            <NiaFields register={register} errors={errors} />
          )}

          {selectedProduct === "DIGITAL_SERVICES" && (
            <DigitalServiceFields register={register} errors={errors} />
          )}

          {serverError && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-[#0f2557] px-5 text-lg font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-5 w-5" />

            {isSubmitting
              ? "Enregistrement en cours..."
              : "Enregistrer le prospect"}
          </button>

          <div className="flex items-center justify-center gap-2 text-center text-sm text-slate-500">
            <ShieldCheck className="h-5 w-5" />
            Les informations sont enregistrées de manière confidentielle.
          </div>
        </form>
      </div>

      {showSuccess && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-3xl border border-emerald-100 bg-white p-5 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-5">
            <div className="flex gap-4">
              <CheckCircle2 className="h-9 w-9 shrink-0 text-emerald-500" />

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Prospect enregistré
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Le rapport de prospection a été soumis avec succès.
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setShowSuccess(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
