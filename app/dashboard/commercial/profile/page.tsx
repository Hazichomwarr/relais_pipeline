import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";

import ProfileEditForm from "@/component/commercial/ProfileEditForm";
import ChangePasswordForm from "@/component/profile/ChangePasswordForm";
import ProfileSummary from "@/component/profile/ProfileSummary";
import { requireCommercial } from "@/src/services/authorization.service";
import { assertCommercialAccess } from "@/src/services/commercial-access.service";
import { CommercialAccessError } from "@/src/services/commercial-access.service-core";

export default async function CommercialProfilePage() {
  const user = await requireCommercial();

  let commercial;

  try {
    commercial = await assertCommercialAccess(user.id);
  } catch (error) {
    if (error instanceof CommercialAccessError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] sm:text-4xl">
          Mon compte
        </h1>
        <p className="mt-2 text-slate-500">
          Consultez et gérez vos informations personnelles.
        </p>
      </div>

      <ProfileSummary
        firstName={commercial.firstName}
        lastName={commercial.lastName}
        email={commercial.email}
        phone={commercial.phone}
        role={commercial.role}
        active={commercial.active}
      />

      <ProfileEditForm
        initialValues={{
          firstName: commercial.firstName,
          lastName: commercial.lastName,
          phone: commercial.phone,
        }}
      />

      <ChangePasswordForm />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-bold text-[#0f2557]">Session</h2>
        <p className="mt-2 text-sm text-slate-500">
          Déconnectez-vous de cet appareil.
        </p>

        <form action="/logout" method="POST" className="mt-5">
          <button
            type="submit"
            className="flex h-13 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </button>
        </form>
      </section>
    </div>
  );
}
