import type { UserRole } from "@prisma/client";

import { userRoleOptions } from "@/src/lib/constants/user-options";

type ProfileSummaryProps = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  active: boolean;
};

export default function ProfileSummary({
  firstName,
  lastName,
  email,
  phone,
  role,
  active,
}: ProfileSummaryProps) {
  const roleLabel =
    userRoleOptions.find((option) => option.value === role)?.label ?? role;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold text-[#0f2557]">Mon profil</h2>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="Prénom" value={firstName} />
        <Field label="Nom" value={lastName} />
        <Field label="E-mail" value={email ?? "Non renseigné"} />
        <Field label="Téléphone" value={phone ?? "Non renseigné"} />
        <Field label="Rôle" value={roleLabel} />
        <div>
          <p className="text-sm text-slate-400">Statut</p>
          <span
            className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
              active
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {active ? "Actif" : "Inactif"}
          </span>
        </div>
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-800">{value}</p>
    </div>
  );
}
