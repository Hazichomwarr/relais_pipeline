import assert from "node:assert/strict";
import test from "node:test";

import { buildFollowUpUrl } from "./follow-up-search-params";

test("updates one queue filter while preserving the others", () => {
  assert.equal(
    buildFollowUpUrl("product=KARMDA&interest=INTERESTED", "userId", "user-1"),
    "/admin/follow-ups?product=KARMDA&interest=INTERESTED&userId=user-1",
  );
});

test("removes an empty queue filter", () => {
  assert.equal(
    buildFollowUpUrl("product=KARMDA&userId=user-1", "product", ""),
    "/admin/follow-ups?userId=user-1",
  );
});
