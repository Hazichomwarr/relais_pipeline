import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { ProspectFormInput } from "@/src/lib/validations/prospect.schema";

import { FormError } from "./form-error";

type DigitalServiceFieldsProps = {
  register: UseFormRegister<ProspectFormInput>;
  errors: FieldErrors<ProspectFormInput>;
};

const inputClassName =
  "h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

export function DigitalServiceFields({
  register,
  errors,
}: DigitalServiceFieldsProps) {
  return (
    <fieldset className="space-y-6 rounded-3xl border border-amber-100 bg-amber-50/40 p-6">
      <legend className="px-2 text-xl font-bold text-amber-900">
        Informations services digitaux
      </legend>

      <div>
        <label htmlFor="businessCategory" className="mb-2 block font-semibold">
          Type d’activité
        </label>

        <select
          id="businessCategory"
          className={inputClassName}
          {...register("businessCategory")}
        >
          <option value="">Sélectionnez une activité</option>
          <option value="RESTAURANT">Restaurant</option>
          <option value="GYM">Salle de sport</option>
          <option value="SALON">Salon de coiffure</option>
          <option value="TECH_SHOP">Boutique tech</option>
          <option value="JEWELRY">Bijouterie</option>
          <option value="GROCERY_STORE">Alimentation</option>
          <option value="CLINIC">Clinique</option>
          <option value="OFFICE">Bureau</option>
          <option value="OTHER">Autre</option>
        </select>

        <FormError message={errors.businessCategory?.message} />
      </div>

      <div>
        <label htmlFor="requestedService" className="mb-2 block font-semibold">
          Service recherché
        </label>

        <select
          id="requestedService"
          className={inputClassName}
          {...register("requestedService")}
        >
          <option value="">Sélectionnez un service</option>
          <option value="WHATSAPP_SETUP">
            Configuration WhatsApp Business
          </option>
          <option value="GOOGLE_VISIBILITY">Visibilité Google</option>
          <option value="SOCIAL_BRANDING">
            Identité sur les réseaux sociaux
          </option>
          <option value="WEBSITE">Création de site web</option>
          <option value="MARKETING">Marketing et promotion</option>
          <option value="MULTIPLE">Plusieurs services</option>
        </select>

        <FormError message={errors.requestedService?.message} />
      </div>
    </fieldset>
  );
}
