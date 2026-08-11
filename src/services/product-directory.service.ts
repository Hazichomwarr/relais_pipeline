import "server-only";

import { prisma } from "@/src/lib/prisma";
import { getProductDirectoryOverviewCore } from "@/src/services/product-directory.service-core";

export async function getProductDirectoryOverview() {
  return getProductDirectoryOverviewCore({
    countByProduct: (product) =>
      prisma.prospect.count({ where: { product } }),
  });
}

export type ProductDirectoryOverview = Awaited<
  ReturnType<typeof getProductDirectoryOverview>
>;
