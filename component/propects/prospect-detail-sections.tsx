import type { Prospect, User } from "@prisma/client";
import type { ReactNode } from "react";

import { getUserRoleLabel } from "@/src/lib/constants/user-options";
import type { ProspectResponsibleDisplay } from "@/src/lib/prospect-responsible-display";

export type ProspectDetailData = Prospect & {
  assignedUser: Pick<
    User,
    "id" | "firstName" | "lastName" | "role" | "active"
  > | null;
};

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
      <h2 className="mb-6 text-xl font-bold text-[#0f2557]">{title}</h2>
      {children}
    </section>
  );
}

export function InfoField({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode | null | undefined;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 font-semibold text-slate-800">
        {value ?? (
          <span className="font-normal text-slate-400">Non renseigné</span>
        )}
      </div>
    </div>
  );
}

/**
 * Ticket 28C §36/§58 — a compact, non-alarming notice for a non-owner
 * Commercial's read-only summary. Deliberately not a full-width alert
 * banner: the prospect's actual information stays the visual focus. Never
 * mentions a management transfer reason — that stays management-only.
 */
export function ReadOnlyNotice({
  responsible,
}: {
  responsible: ProspectResponsibleDisplay;
}) {
  return (
    <div className="mb-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      <p className="font-semibold text-slate-700">Lecture seule</p>
      <p className="mt-1">
        Ce prospect est suivi par un autre responsable. Vous pouvez
        consulter les informations disponibles, mais les actions de suivi
        sont réservées au responsable actuel.
      </p>
      {responsible.assigned && (
        <p className="mt-2">
          Responsable du suivi :{" "}
          <span className="font-semibold">{responsible.name}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Ticket 28C §4/§29 — "Responsable du suivi" is the terminology used
 * everywhere a current assignee is shown, replacing the older "Commercial
 * assigné" wording: 28B correctly allows active ADMIN/MANAGER/COMMERCIAL
 * as assignees, so labeling it "Commercial" would misdescribe a
 * management-owned prospect. Purely a display block — no mutation
 * control; the management-only Réassigner action lives in
 * ProspectResponsibilitySection.
 */
export function ResponsibleUserInfo({
  responsible,
}: {
  responsible: ProspectResponsibleDisplay;
}) {
  if (!responsible.assigned) {
    return <span className="font-normal text-slate-400">Aucun responsable actuellement</span>;
  }

  return (
    <span>
      {responsible.name}
      <span className="ml-2 text-xs font-normal text-slate-400">
        {getUserRoleLabel(responsible.role)}
        {!responsible.active && " · Inactif"}
      </span>
    </span>
  );
}

export function Badge({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${className}`}>
      {children}
    </span>
  );
}

export function ProductDetailSection({
  prospect,
}: {
  prospect: ProspectDetailData;
}) {
  const fields = getProductFields(prospect);

  return (
    <DetailSection title={`Informations ${getProductLabel(prospect.product)}`}>
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((field) => (
          <InfoField
            key={field.label}
            label={field.label}
            value={field.value}
          />
        ))}
      </div>
    </DetailSection>
  );
}

export function getProductFields(prospect: ProspectDetailData) {
  switch (prospect.product) {
    case "KARMDA":
      return [
        { label: "Type d’établissement", value: prospect.schoolType },
        {
          label: "Nombre estimé d’élèves",
          value: prospect.estimatedStudentCount,
        },
        {
          label: "Système scolaire actuel",
          value: prospect.currentSchoolSystem,
        },
        { label: "Rôle du contact", value: prospect.contactRole },
      ];
    case "LOKARI":
      return [
        { label: "Type de propriétaire", value: prospect.propertyOwnerType },
        {
          label: "Nombre estimé de biens",
          value: prospect.estimatedPropertyCount,
        },
        { label: "Pays des propriétés", value: prospect.propertyCountries },
        {
          label: "Système immobilier actuel",
          value: prospect.currentPropertySystem,
        },
      ];
    case "NIA":
      return [
        { label: "Type de groupe", value: prospect.savingsGroupType },
        {
          label: "Nombre estimé de membres",
          value: prospect.estimatedMemberCount,
        },
        {
          label: "Fréquence des cotisations",
          value: prospect.contributionFrequency,
        },
        {
          label: "Système d’épargne actuel",
          value: prospect.currentSavingsSystem,
        },
      ];
    case "DIGITAL_SERVICES":
      return [
        { label: "Catégorie d’activité", value: prospect.businessCategory },
        { label: "Service demandé", value: prospect.requestedService },
      ];
  }
}

export function getProductLabel(product: ProspectDetailData["product"]) {
  return {
    KARMDA: "KARMDA",
    LOKARI: "LOKARI",
    NIA: "NIA",
    DIGITAL_SERVICES: "Services digitaux",
  }[product];
}

export function getInterestLabel(interest: ProspectDetailData["interest"]) {
  return {
    NOT_INTERESTED: "Pas intéressé",
    MAYBE: "Peut-être",
    NEEDS_INFORMATION: "Veut plus d’informations",
    INTERESTED: "Intéressé",
    READY_TO_DISCUSS: "Prêt à discuter",
  }[interest];
}

export function getInterestStyles(interest: ProspectDetailData["interest"]) {
  if (interest === "INTERESTED" || interest === "READY_TO_DISCUSS") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (interest === "NOT_INTERESTED") {
    return "bg-red-100 text-red-800";
  }
  if (interest === "NEEDS_INFORMATION") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-slate-100 text-slate-700";
}

export function getStatusLabel(status: ProspectDetailData["status"]) {
  return {
    NEW: "Nouveau",
    TO_FOLLOW_UP: "À suivre",
    CONTACTED: "Contacté",
    QUALIFIED: "Qualifié",
    PROPOSAL_SENT: "Proposition envoyée",
    WON: "Gagné",
    LOST: "Perdu",
  }[status];
}

export function getOnlinePresenceLabel(
  presence: ProspectDetailData["onlinePresence"],
) {
  if (!presence) {
    return null;
  }

  return {
    NONE: "Aucune",
    WHATSAPP: "WhatsApp Business",
    SOCIAL_MEDIA: "Réseaux sociaux",
    WEBSITE: "Site internet",
    MULTIPLE: "Plusieurs plateformes",
  }[presence];
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
