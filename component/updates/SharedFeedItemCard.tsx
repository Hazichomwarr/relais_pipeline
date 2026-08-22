import type { UserRole } from "@prisma/client";
import {
  CheckCircle,
  MessageSquare,
  PartyPopper,
  UserCheck,
  UserPlus,
  UserX,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { getUserRoleLabel } from "@/src/lib/constants/user-options";
import { getInitialsFromName } from "@/src/lib/initials";
import { resolveSharedFeedProspectHref } from "@/src/lib/shared-feed-prospect-navigation";
import { formatSharedFeedTimestamp } from "@/src/lib/shared-feed-timestamp";
import type { SharedFeedItem } from "@/src/services/shared-feed.service-core";

export type SharedFeedViewer = {
  id: string;
  role: UserRole;
};

type SharedFeedItemCardProps = {
  item: SharedFeedItem;
  viewer: SharedFeedViewer;
  referenceDate: Date;
};

const eventIcons: Record<SharedFeedItem["type"], LucideIcon> = {
  PROSPECT_INTERACTION: MessageSquare,
  FOLLOW_UP_COMPLETED: CheckCircle,
  PROSPECT_WON: PartyPopper,
  USER_CREATED: UserPlus,
  USER_ACTIVATED: UserCheck,
  USER_DEACTIVATED: UserX,
};

const badgeStyles: Record<SharedFeedItem["type"], string> = {
  PROSPECT_INTERACTION: "bg-blue-600 text-white",
  FOLLOW_UP_COMPLETED: "bg-emerald-600 text-white",
  PROSPECT_WON: "bg-emerald-600 text-white",
  USER_CREATED: "bg-blue-600 text-white",
  USER_ACTIVATED: "bg-emerald-600 text-white",
  USER_DEACTIVATED: "bg-slate-500 text-white",
};

/** Who the avatar's initials belong to — the acting commercial for
 * prospect events, and the affected/created user for user events. */
function getAvatarName(item: SharedFeedItem): string | null {
  if (item.type === "USER_CREATED") {
    return item.subjectDisplayName;
  }

  if (item.type === "USER_ACTIVATED" || item.type === "USER_DEACTIVATED") {
    return item.userDisplayName;
  }

  return item.actorName;
}

/**
 * A single discriminated card, per Ticket 18B ("a single discriminated
 * SharedFeedItemCard may be cleaner" than five near-identical components).
 * Pure presentation only — every field it reads was already produced by
 * getSharedFeed() (Ticket 18A); no Prisma access and no history
 * reconstruction happen here.
 */
export default function SharedFeedItemCard({
  item,
  viewer,
  referenceDate,
}: SharedFeedItemCardProps) {
  const Icon = eventIcons[item.type];
  const isWon = item.type === "PROSPECT_WON";
  const timestamp = formatSharedFeedTimestamp(
    new Date(item.occurredAt),
    referenceDate,
  );
  const prospectHref =
    item.type === "PROSPECT_INTERACTION" ||
    item.type === "FOLLOW_UP_COMPLETED" ||
    item.type === "PROSPECT_WON"
      ? resolveSharedFeedProspectHref(viewer, {
          id: item.prospectId,
          product: item.prospectProduct,
          assignedUserId: item.prospectAssignedUserId,
        })
      : null;

  return (
    <article
      className={`rounded-3xl border p-5 shadow-sm sm:p-6 ${
        isWon
          ? "border-2 border-emerald-200 bg-emerald-50/60"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">
          {getInitialsFromName(getAvatarName(item))}
          <span
            aria-hidden="true"
            className={`absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white ${badgeStyles[item.type]}`}
          >
            <Icon className="h-3 w-3" />
          </span>
        </span>

        <div className="min-w-0 flex-1">
          {isWon && (
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
              🎉 Nouveau client
            </p>
          )}

          <SharedFeedItemBody item={item} />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <time
              dateTime={timestamp.iso}
              title={timestamp.exact}
              className="text-xs text-slate-400"
            >
              {timestamp.display}
            </time>

            {prospectHref && (
              <Link
                href={prospectHref}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Voir le prospect
                <span className="sr-only"> — {getProspectName(item)}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function getProspectName(item: SharedFeedItem): string {
  return item.type === "PROSPECT_INTERACTION" ||
    item.type === "FOLLOW_UP_COMPLETED" ||
    item.type === "PROSPECT_WON"
    ? item.prospectName
    : "";
}

function SharedFeedItemBody({ item }: { item: SharedFeedItem }) {
  switch (item.type) {
    case "PROSPECT_INTERACTION":
      return (
        <>
          <p className="font-semibold text-slate-900">
            {item.actorName ?? "Un commercial"}{" "}
            <span className="font-normal text-slate-600">
              a ajouté une interaction sur{" "}
            </span>
            {item.prospectName}
          </p>
          {item.preview && (
            <blockquote className="mt-3 line-clamp-4 border-l-2 border-blue-200 pl-3 text-sm italic leading-6 text-slate-500">
              « {item.preview} »
            </blockquote>
          )}
        </>
      );

    case "FOLLOW_UP_COMPLETED":
      return (
        <p className="font-semibold text-slate-900">
          {item.actorName ?? "Un commercial"}{" "}
          <span className="font-normal text-slate-600">
            a terminé un suivi avec
          </span>{" "}
          {item.prospectName}.
        </p>
      );

    case "PROSPECT_WON":
      return (
        <>
          <p className="font-bold text-slate-900">
            {item.prospectName}{" "}
            <span className="font-normal text-slate-600">
              est devenu client.
            </span>
          </p>
          {item.actorName && (
            <p className="mt-1 text-sm text-slate-500">
              Commercial : {item.actorName}
            </p>
          )}
        </>
      );

    case "USER_CREATED":
      return (
        <>
          <p className="font-semibold text-slate-900">
            {item.actorName}{" "}
            <span className="font-normal text-slate-600">a ajouté</span>{" "}
            {item.subjectDisplayName}.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Rôle à l’arrivée : {getUserRoleLabel(item.roleAtEvent)}
          </p>
        </>
      );

    case "USER_ACTIVATED":
      return (
        <>
          <p className="font-semibold text-slate-900">
            {item.userDisplayName}{" "}
            <span className="font-normal text-slate-600">
              vient d’être activé(e) comme {getUserRoleLabel(item.userRole)}.
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Activé(e) par {item.actorName}
          </p>
        </>
      );

    case "USER_DEACTIVATED":
      return (
        <>
          <p className="font-semibold text-slate-900">
            {item.userDisplayName}{" "}
            <span className="font-normal text-slate-600">
              a été désactivé(e).
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Action effectuée par {item.actorName}
          </p>
        </>
      );
  }
}
