import {
  FileText,
  LayoutDashboard,
  Library,
  ListChecks,
  Newspaper,
  StickyNote,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";

export type CommercialActiveItem =
  | "dashboard"
  | "updates"
  | "newProspect"
  | "prospects"
  | "products"
  | "followUps"
  | "notes"
  | "reports"
  | "profile";

export type CommercialNavItem = {
  key: CommercialActiveItem;
  label: string;
  href: string;
  /** A rendered icon element, not a component reference — see
   * MobileNavDrawer's MobileNavItem for why. */
  icon: React.ReactNode;
};

export const commercialNavItems: CommercialNavItem[] = [
  {
    key: "dashboard",
    label: "Tableau de bord",
    href: "/dashboard/commercial",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    key: "updates",
    label: "À la une",
    href: "/updates",
    icon: <Newspaper className="h-5 w-5" />,
  },
  {
    key: "newProspect",
    label: "Nouveau prospect",
    href: "/",
    icon: <UserPlus className="h-5 w-5" />,
  },
  {
    key: "prospects",
    label: "Mes prospects",
    href: "/dashboard/commercial#mes-prospects",
    icon: <Users className="h-5 w-5" />,
  },
  {
    key: "products",
    label: "Répertoire",
    href: "/products",
    icon: <Library className="h-5 w-5" />,
  },
  {
    key: "followUps",
    label: "Mes suivis",
    href: "/dashboard/commercial#mes-suivis",
    icon: <ListChecks className="h-5 w-5" />,
  },
  {
    key: "notes",
    label: "Mes notes",
    href: "/notes",
    icon: <StickyNote className="h-5 w-5" />,
  },
  {
    key: "reports",
    label: "Mes rapports",
    href: "/reports",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    key: "profile",
    label: "Mon profil",
    href: "/dashboard/commercial/profile",
    icon: <UserRound className="h-5 w-5" />,
  },
];

/**
 * The commercial dashboard, prospects, and follow-ups all live under
 * /dashboard/commercial (prospects/follow-ups are in-page anchors, not
 * routes), so highlighting is resolved from pathname rather than a
 * per-page activeItem prop — that also lets the shell live in
 * app/dashboard/commercial/layout.tsx and stay mounted across that
 * segment's loading boundaries instead of flashing in per page.
 */
export function resolveCommercialActiveItem(
  pathname: string | null,
): CommercialActiveItem | undefined {
  const path = pathname ?? "";

  // Exact match only — "/" is a prefix of every route, so a startsWith
  // check here would make Nouveau prospect active everywhere.
  if (path === "/") {
    return "newProspect";
  }

  if (path === "/dashboard/commercial/profile") {
    return "profile";
  }

  if (path.startsWith("/dashboard/commercial/prospects")) {
    return "prospects";
  }

  if (path === "/dashboard/commercial") {
    return "dashboard";
  }

  if (path === "/updates" || path.startsWith("/updates/")) {
    return "updates";
  }

  if (path === "/products" || path.startsWith("/products/")) {
    return "products";
  }

  // /schools is a legacy redirect target (Ticket 15G.1) — keep it
  // highlighting Répertoire for anyone who still lands on the old route.
  if (path === "/schools" || path.startsWith("/schools/")) {
    return "products";
  }

  if (path === "/notes" || path.startsWith("/notes/")) {
    return "notes";
  }

  if (path === "/reports" || path.startsWith("/reports/")) {
    return "reports";
  }

  return undefined;
}
