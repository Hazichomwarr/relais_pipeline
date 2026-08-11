import type { RelaisProduct } from "@prisma/client";

import {
  getProductDirectoryHref,
  listProductDirectoryConfigs,
} from "@/src/lib/product-directory";

export type ProductDirectoryOverviewItem = {
  product: RelaisProduct;
  slug: string;
  label: string;
  description: string;
  prospectCount: number;
  href: string;
};

export type ProductDirectoryOverviewDependencies = {
  countByProduct: (product: RelaisProduct) => Promise<number>;
};

/**
 * Company-wide by construction — countByProduct never receives an owner
 * scope, so ADMIN/MANAGER/COMMERCIAL-owned prospects all count equally
 * (Ticket 15G.1 / 15H.1). Ordering comes from listProductDirectoryConfigs(),
 * not enum/DB accident.
 */
export async function getProductDirectoryOverviewCore(
  dependencies: ProductDirectoryOverviewDependencies,
): Promise<ProductDirectoryOverviewItem[]> {
  const configs = listProductDirectoryConfigs();
  const counts = await Promise.all(
    configs.map((config) => dependencies.countByProduct(config.product)),
  );

  return configs.map((config, index) => ({
    product: config.product,
    slug: config.slug,
    label: config.label,
    description: config.description,
    prospectCount: counts[index],
    href: getProductDirectoryHref(config.product),
  }));
}
