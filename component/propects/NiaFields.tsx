import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { ProspectFormInput } from "@/src/lib/validations/prospect.schema";

import { FormError } from "./form-error";

type NiaFieldsProps = {
  register: UseFormRegister<ProspectFormInput>;
  errors: FieldErrors<ProspectFormInput>;
};

const inputClassName =
  "h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

export function NiaFields({ register, errors }: NiaFieldsProps) {
  return (
    <fieldset className="space-y-6 rounded-3xl border border-violet-100 bg-violet-50/40 p-6">
      <legend className="px-2 text-xl font-bold text-violet-900">
        Informations NIA
      </legend>

      <div>
        <label htmlFor="savingsGroupType" className="mb-2 block font-semibold">
          Type de groupe
        </label>

        <select
          id="savingsGroupType"
          className={inputClassName}
          {...register("savingsGroupType")}
        >
          <option value="">Sélectionnez un type</option>
          <option value="TONTINE">Tontine</option>
          <option value="SAVINGS_GROUP">Groupe d’épargne</option>
          <option value="ASSOCIATION">Association</option>
          <option value="COOPERATIVE">Coopérative</option>
          <option value="OTHER">Autre</option>
        </select>

        <FormError message={errors.savingsGroupType?.message} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label
            htmlFor="estimatedMemberCount"
            className="mb-2 block font-semibold"
          >
            Nombre approximatif de membres
          </label>

          <input
            id="estimatedMemberCount"
            type="number"
            min="0"
            placeholder="Ex : 30"
            className={inputClassName}
            {...register("estimatedMemberCount")}
          />

          <FormError message={errors.estimatedMemberCount?.message} />
        </div>

        <div>
          <label
            htmlFor="contributionFrequency"
            className="mb-2 block font-semibold"
          >
            Fréquence des cotisations
          </label>

          <input
            id="contributionFrequency"
            type="text"
            placeholder="Ex : Hebdomadaire"
            className={inputClassName}
            {...register("contributionFrequency")}
          />

          <FormError message={errors.contributionFrequency?.message} />
        </div>
      </div>

      <div>
        <label
          htmlFor="currentSavingsSystem"
          className="mb-2 block font-semibold"
        >
          Méthode actuelle de suivi
        </label>

        <input
          id="currentSavingsSystem"
          type="text"
          placeholder="Ex : Cahier, WhatsApp, Excel..."
          className={inputClassName}
          {...register("currentSavingsSystem")}
        />

        <FormError message={errors.currentSavingsSystem?.message} />
      </div>
    </fieldset>
  );
}
