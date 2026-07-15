import type { UseFormRegister } from "react-hook-form";

import {
  followUpActionOptions,
  interestOptions,
  onlinePresenceOptions,
  productOptions,
} from "@/src/lib/constants/prospect-options";
import type { ProspectFormInput } from "@/src/lib/validations/prospect.schema";

import { FormError } from "./form-error";

type SharedProspectFieldsProps = {
  register: UseFormRegister<ProspectFormInput>;
  errors: Record<string, { message?: string } | undefined>;
};

const inputClassName =
  "h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

const selectClassName = `${inputClassName} text-slate-600`;

export function SharedProspectFields({
  register,
  errors,
}: SharedProspectFieldsProps) {
  return (
    <div className="space-y-7">
      <div>
        <label
          htmlFor="product"
          className="mb-2 block font-semibold text-slate-800"
        >
          Produit RELAIS
        </label>

        <select
          id="product"
          className={selectClassName}
          {...register("product")}
        >
          <option value="">Sélectionnez un produit</option>

          {productOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <FormError message={errors.product?.message} />
      </div>

      <div>
        <label
          htmlFor="name"
          className="mb-2 block font-semibold text-slate-800"
        >
          Nom du service
        </label>

        <input
          id="name"
          type="text"
          placeholder="Ex: Etablissement..."
          className={inputClassName}
          {...register("name")}
        />

        <FormError message={errors.name?.message} />
      </div>

      <div>
        <label
          htmlFor="prospectType"
          className="mb-2 block font-semibold text-slate-800"
        >
          Type de service
        </label>

        <input
          id="prospectType"
          type="text"
          placeholder="Ex : École privée, Commerce, tontine..."
          className={inputClassName}
          {...register("prospectType")}
        />

        <FormError message={errors.prospectType?.message} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label
            htmlFor="contactName"
            className="mb-2 block font-semibold text-slate-800"
          >
            Nom du responsable
          </label>

          <input
            id="contactName"
            type="text"
            placeholder="Ex : Mme Ouédraogo"
            className={inputClassName}
            {...register("contactName")}
          />

          <FormError message={errors.contactName?.message} />
        </div>

        <div>
          <label
            htmlFor="phone"
            className="mb-2 block font-semibold text-slate-800"
          >
            Téléphone / WhatsApp
          </label>

          <input
            id="phone"
            type="tel"
            placeholder="Ex : 70 12 34 56"
            className={inputClassName}
            {...register("phone")}
          />

          <FormError message={errors.phone?.message} />
        </div>
      </div>

      <div>
        <label
          htmlFor="location"
          className="mb-2 block font-semibold text-slate-800"
        >
          Ville ou quartier
        </label>

        <input
          id="location"
          type="text"
          placeholder="Ex : Karpala, Ouagadougou"
          className={inputClassName}
          {...register("location")}
        />

        <FormError message={errors.location?.message} />
      </div>

      <div>
        <label
          htmlFor="onlinePresence"
          className="mb-2 block font-semibold text-slate-800"
        >
          Présence actuelle en ligne
        </label>

        <select
          id="onlinePresence"
          className={selectClassName}
          {...register("onlinePresence")}
        >
          <option value="">Sélectionnez une option</option>

          {onlinePresenceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <FormError message={errors.onlinePresence?.message} />
      </div>

      <div>
        <label
          htmlFor="interest"
          className="mb-2 block font-semibold text-slate-800"
        >
          Niveau d’intérêt au produit proposé
        </label>

        <select
          id="interest"
          className={selectClassName}
          {...register("interest")}
        >
          <option value="">Sélectionnez le niveau d’intérêt</option>

          {interestOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <FormError message={errors.interest?.message} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label
            htmlFor="nextAction"
            className="mb-2 block font-semibold text-slate-800"
          >
            Prochaine action
          </label>

          <select
            id="nextAction"
            className={selectClassName}
            {...register("nextAction")}
          >
            <option value="">Sélectionnez une action</option>

            {followUpActionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <FormError message={errors.nextAction?.message} />
        </div>

        <div>
          <label
            htmlFor="followUpDate"
            className="mb-2 block font-semibold text-slate-800"
          >
            Date de suivi
          </label>

          <input
            id="followUpDate"
            type="date"
            className={inputClassName}
            {...register("followUpDate")}
          />

          <FormError message={errors.followUpDate?.message} />
        </div>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="mb-2 block font-semibold text-slate-800"
        >
          Notes de prospection
        </label>

        <textarea
          id="notes"
          rows={5}
          placeholder="Ce que le prospect a dit, ses besoins, ses objections et la prochaine étape..."
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100"
          {...register("notes")}
        />

        <FormError message={errors.notes?.message} />
      </div>

      <div>
        <label
          htmlFor="agentName"
          className="mb-2 block font-semibold text-slate-800"
        >
          Nom du commercial
        </label>

        <input
          id="agentName"
          type="text"
          placeholder="Votre nom"
          className={inputClassName}
          {...register("agentName")}
        />

        <FormError message={errors.agentName?.message} />
      </div>
    </div>
  );
}
