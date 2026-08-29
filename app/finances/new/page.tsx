import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import LedgerEntryForm from "@/component/finances/LedgerEntryForm";
import {
  AuthorizationError,
  requireFinanceAccess,
} from "@/src/services/authorization.service";

type NewLedgerEntrySearchParams = Promise<{ type?: string }>;

/**
 * Ticket 17B: mutation access was ADMIN-only. Ticket 25N: ADMIN or
 * ASSISTANT via the shared Finance capability — a MANAGER or COMMERCIAL
 * who reaches /finances is never shown the create buttons, and a direct
 * visit here is redirected server-side rather than merely hiding the
 * form.
 */
export default async function NewLedgerEntryPage({
  searchParams,
}: {
  searchParams: NewLedgerEntrySearchParams;
}) {
  try {
    await requireFinanceAccess();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.code === "UNAUTHENTICATED" ? "/login" : "/finances");
    }
    throw error;
  }

  const params = await searchParams;

  if (params.type !== "INFLOW" && params.type !== "OUTFLOW") {
    redirect("/finances");
  }

  const type = params.type;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/finances"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux finances
      </Link>

      <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] md:text-4xl">
        {type === "INFLOW" ? "Nouvelle entrée" : "Nouvelle sortie"}
      </h1>
      <p className="mt-2 max-w-xl text-base text-slate-500">
        {type === "INFLOW"
          ? "Enregistrez un montant reçu dans la caisse de RELAIS."
          : "Enregistrez un montant sorti de la caisse de RELAIS."}
      </p>

      <section className="mt-7 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <LedgerEntryForm type={type} />
      </section>
    </div>
  );
}
