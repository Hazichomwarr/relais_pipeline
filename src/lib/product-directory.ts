import type { RelaisProduct } from "@prisma/client";

export type ProductDirectoryConfig = {
  product: RelaisProduct;
  slug: string;
  label: string;
  description: string;
};

/**
 * label mirrors getProductLabel() in
 * component/propects/prospect-detail-sections.tsx — duplicated rather than
 * imported because src/lib must not depend on the component layer.
 * Record<RelaisProduct, ...> forces every enum value to have an entry, so a
 * future product added to the Prisma schema fails to compile here until
 * this config is updated (Ticket 15G.1).
 */
const productDirectoryEntries: Record<
  RelaisProduct,
  Omit<ProductDirectoryConfig, "product">
> = {
  KARMDA: {
    slug: "karmda",
    label: "KARMDA",
    description: "Écoles et établissements scolaires prospectés pour KARMDA.",
  },
  DIGITAL_SERVICES: {
    slug: "digital-services",
    label: "Services digitaux",
    description:
      "Entreprises et organisations prospectées pour les services digitaux RELAIS.",
  },
  LOKARI: {
    slug: "lokari",
    label: "LOKARI",
    description: "Prospects liés aux solutions de gestion immobilière.",
  },
  NIA: {
    slug: "nia",
    label: "NIA",
    description: "Groupes d’épargne et tontines prospectés pour NIA.",
  },
};

/** Deliberate business display order — not enum/DB declaration order. */
const productDisplayOrder: readonly RelaisProduct[] = [
  "KARMDA",
  "DIGITAL_SERVICES",
  "LOKARI",
  "NIA",
];

export function listProductDirectoryConfigs(): ProductDirectoryConfig[] {
  return productDisplayOrder.map((product) => ({
    product,
    ...productDirectoryEntries[product],
  }));
}

export function getProductDirectoryConfig(
  product: RelaisProduct,
): ProductDirectoryConfig {
  return { product, ...productDirectoryEntries[product] };
}

export function getProductDirectorySlug(product: RelaisProduct): string {
  return productDirectoryEntries[product].slug;
}

export function getProductFromDirectorySlug(
  slug: string,
): RelaisProduct | null {
  const match = productDisplayOrder.find(
    (product) => productDirectoryEntries[product].slug === slug,
  );
  return match ?? null;
}

export function getProductDirectoryHref(product: RelaisProduct): string {
  return `/products/${getProductDirectorySlug(product)}`;
}
