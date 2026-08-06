import { useEffect, useRef, useState } from "react";

import { findPossibleSchoolDuplicatesAction } from "@/src/actions/school-duplicate.actions";
import { isSearchableSchoolName } from "@/src/lib/school-name-normalization";
import type { PossibleSchoolDuplicate } from "@/src/services/school-duplicate.service-core";

const DEBOUNCE_MS = 400;

export type SchoolDuplicateLookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; matches: PossibleSchoolDuplicate[] }
  | { status: "error"; message: string };

type FetchOutcome =
  | { status: "success"; matches: PossibleSchoolDuplicate[] }
  | { status: "error"; message: string };

type CompletedResult = {
  query: string;
  outcome: FetchOutcome;
};

/**
 * `active` should be `product === "KARMDA"`. Both "idle" (inactive or below
 * the minimum search length) and "loading" (the debounce/fetch for the
 * current name hasn't landed yet) are derived from render inputs rather
 * than set imperatively — the only setState call lives inside the fetch's
 * `.then()`, which runs asynchronously relative to the effect, so there's
 * never a synchronous setState-in-effect render cascade. A request counter
 * guards against a slow, now-stale response overwriting a newer one.
 */
export function useSchoolDuplicateLookup(
  active: boolean,
  name: string,
): SchoolDuplicateLookupState {
  const searchable = active && isSearchableSchoolName(name);
  const [completed, setCompleted] = useState<CompletedResult | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;

    if (!searchable) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      findPossibleSchoolDuplicatesAction(name).then((response) => {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setCompleted({
          query: name,
          outcome: response.success
            ? { status: "success", matches: response.matches }
            : { status: "error", message: response.message },
        });
      });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchable, name]);

  if (!searchable) {
    return { status: "idle" };
  }

  if (!completed || completed.query !== name) {
    return { status: "loading" };
  }

  return completed.outcome;
}
