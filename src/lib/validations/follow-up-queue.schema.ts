import { z } from "zod";

import {
  followUpActions,
  interestLevels,
  relaisProducts,
} from "./prospect.schema";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().max(100).optional(),
);

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.enum(values).optional(),
  );

export const followUpQueueFilterSchema = z.object({
  userId: optionalText,
  product: optionalEnum(relaisProducts),
  interest: optionalEnum(interestLevels),
  nextAction: optionalEnum(followUpActions),
});

export type FollowUpQueueFilters = z.output<
  typeof followUpQueueFilterSchema
>;
