import assert from "node:assert/strict";
import test from "node:test";

import { getDailyReportTemplateTypeLabel } from "./daily-report-options";

test("getDailyReportTemplateTypeLabel maps every template to its French label", () => {
  assert.equal(getDailyReportTemplateTypeLabel("ASSISTANT"), "Assistante de Direction");
  assert.equal(
    getDailyReportTemplateTypeLabel("OPERATIONS_COORDINATOR"),
    "Coordinateur des Opérations",
  );
});
