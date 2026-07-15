import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { ProspectFormInput } from "@/src/lib/validations/prospect.schema";

import { FormError } from "./form-error";

type KarmdaFieldsProps = {
  register: UseFormRegister<ProspectFormInput>;
  errors: FieldErrors<ProspectFormInput>;
};

const inputClassName =
  "h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100";

export function KarmdaFields({ register, errors }: KarmdaFieldsProps) {
  return (
    <fieldset className="space-y-6 rounded-3xl border border-blue-100 bg-blue-50/40 p-6">
      <legend className="px-2 text-xl font-bold text-[#0f2557]">
        Informations KARMDA
      </legend>

      <div>
        <label htmlFor="schoolType" className="mb-2 block font-semibold">
          Type d’établissement
        </label>

        <select
          id="schoolType"
          className={inputClassName}
          {...register("schoolType")}
        >
          <option value="">Sélectionnez un type</option>
          <option value="PRIVATE_PRIMARY">École primaire privée</option>
          <option value="PRIVATE_SECONDARY">Collège ou lycée privé</option>
          <option value="PRIVATE_COMPLEX">Complexe scolaire privé</option>
          <option value="PUBLIC">Établissement public</option>
          <option value="TRAINING_CENTER">Centre de formation</option>
          <option value="OTHER">Autre</option>
        </select>

        <FormError message={errors.schoolType?.message} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label
            htmlFor="estimatedStudentCount"
            className="mb-2 block font-semibold"
          >
            Nombre approximatif d’élèves
          </label>

          <input
            id="estimatedStudentCount"
            type="number"
            min="0"
            placeholder="Ex : 450"
            className={inputClassName}
            {...register("estimatedStudentCount")}
          />

          <FormError message={errors.estimatedStudentCount?.message} />
        </div>

        <div>
          <label
            htmlFor="schoolContactRole"
            className="mb-2 block font-semibold"
          >
            Fonction de la personne rencontrée
          </label>

          <input
            id="schoolContactRole"
            type="text"
            placeholder="Ex : Fondateur, directeur, comptable"
            className={inputClassName}
            {...register("contactRole")}
          />

          <FormError message={errors.contactRole?.message} />
        </div>
      </div>

      <div>
        <label
          htmlFor="currentSchoolSystem"
          className="mb-2 block font-semibold"
        >
          Système de gestion actuel
        </label>

        <input
          id="currentSchoolSystem"
          type="text"
          placeholder="Ex : Cahiers, Excel, autre logiciel..."
          className={inputClassName}
          {...register("currentSchoolSystem")}
        />

        <FormError message={errors.currentSchoolSystem?.message} />
      </div>
    </fieldset>
  );
}
