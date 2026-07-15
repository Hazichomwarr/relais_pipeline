import type {
  InterestLevel,
  ProspectStatus,
  RelaisProduct,
} from "@prisma/client";

export type ProspectFilters = {
  search?: string;
  product?: RelaisProduct;
  interest?: InterestLevel;
  status?: ProspectStatus;
  agent?: string;
  date?: string;
};
