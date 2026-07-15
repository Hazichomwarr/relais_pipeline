import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { ProspectFormInput } from "@/src/lib/validations/prospect.schema";

import { FormError } from "./form-error";

type LokariFieldsProps = {
  register: UseFormRegister<ProspectFormInput>;
  errors: FieldErrors<ProspectFormInput>;
};

const inputClassName =
  "h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

export function LokariFields({ register, errors }: LokariFieldsProps) {
  return (
    <fieldset className="space-y-6 rounded-3xl border border-emerald-100 bg-emerald-50/40 p-6">
      <legend className="px-2 text-xl font-bold text-emerald-900">
        Informations LOKARI
      </legend>

      <div>
        <label htmlFor="propertyOwnerType" className="mb-2 block font-semibold">
          Type de prospect immobilier
        </label>

        <select
          id="propertyOwnerType"
          className={inputClassName}
          {...register("propertyOwnerType")}
        >
          <option value="">Sélectionnez un type</option>
          <option value="INDIVIDUAL_OWNER">Propriétaire particulier</option>
          <option value="DIASPORA_OWNER">Propriétaire de la diaspora</option>
          <option value="REAL_ESTATE_AGENCY">Agence immobilière</option>
          <option value="PROPERTY_MANAGER">Gestionnaire immobilier</option>
          <option value="OTHER">Autre</option>
        </select>

        <FormError message={errors.propertyOwnerType?.message} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label
            htmlFor="estimatedPropertyCount"
            className="mb-2 block font-semibold"
          >
            Nombre approximatif de propriétés
          </label>

          <input
            id="estimatedPropertyCount"
            type="number"
            min="0"
            placeholder="Ex : 12"
            className={inputClassName}
            {...register("estimatedPropertyCount")}
          />

          <FormError message={errors.estimatedPropertyCount?.message} />
        </div>

        <div>
          <label
            htmlFor="propertyCountries"
            className="mb-2 block font-semibold"
          >
            Pays des propriétés
          </label>

          <input
            id="propertyCountries"
            type="text"
            placeholder="Ex : Burkina Faso, États-Unis"
            className={inputClassName}
            {...register("propertyCountries")}
          />

          <FormError message={errors.propertyCountries?.message} />
        </div>
      </div>

      <div>
        <label
          htmlFor="currentPropertySystem"
          className="mb-2 block font-semibold"
        >
          Méthode actuelle de gestion
        </label>

        <input
          id="currentPropertySystem"
          type="text"
          placeholder="Ex : Cahier, WhatsApp, Excel, agence..."
          className={inputClassName}
          {...register("currentPropertySystem")}
        />

        <FormError message={errors.currentPropertySystem?.message} />
      </div>
    </fieldset>
  );
}
