import { ArrowLeft, CalendarDays, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Badge,
  DetailSection,
  InfoField,
  ReadOnlyNotice,
  ResponsibleUserInfo,
  formatDateTime,
  getInterestLabel,
  getInterestStyles,
  getStatusLabel,
} from "@/component/propects/prospect-detail-sections";
import { requireRole } from "@/src/services/authorization.service";
import { getSchoolSummaryById } from "@/src/services/school-directory.service";

type SchoolSummaryPageProps = {
  params: Promise<{ prospectId: string }>;
};

export default async function SchoolSummaryPage({
  params,
}: SchoolSummaryPageProps) {
  await requireRole("ADMIN", "MANAGER", "COMMERCIAL");
  const { prospectId } = await params;

  const school = await getSchoolSummaryById(prospectId);

  if (!school) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/schools"
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-[#0f2557]"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à toutes les écoles
      </Link>

      <ReadOnlyNotice responsible={school.responsible} />

      <header className="rounded-4xl bg-[#0f2557] px-6 py-7 text-white shadow-[0_18px_50px_rgba(15,37,87,0.18)] md:px-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge className="bg-white/15 text-white">
            {getStatusLabel(school.status)}
          </Badge>
          <Badge className={getInterestStyles(school.interest)}>
            {getInterestLabel(school.interest)}
          </Badge>
        </div>

        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          {school.name}
        </h1>
      </header>

      <div className="mt-6">
        <DetailSection title="Résumé">
          <div className="grid gap-5 sm:grid-cols-2">
            <InfoField
              icon={<UserRound className="h-5 w-5" />}
              label="Responsable du suivi"
              value={<ResponsibleUserInfo responsible={school.responsible} />}
            />
            <InfoField
              icon={<CalendarDays className="h-5 w-5" />}
              label="Dernière activité"
              value={
                school.lastActivityAt
                  ? formatDateTime(school.lastActivityAt)
                  : "Aucune activité enregistrée"
              }
            />
          </div>

          <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-400">
            Ce résumé est en lecture seule — les actions de suivi sont
            réservées au responsable actuel.
          </p>
        </DetailSection>
      </div>
    </main>
  );
}
