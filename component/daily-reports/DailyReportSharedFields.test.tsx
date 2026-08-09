import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import DailyReportSharedFields from "./DailyReportSharedFields";

type Fields = { accomplishedToday: string; plannedTomorrow: string };

function stubRegister(): UseFormRegister<Fields> {
  return ((name: string) => ({
    name,
    onChange: async () => undefined,
    onBlur: async () => undefined,
    ref: () => undefined,
  })) as unknown as UseFormRegister<Fields>;
}

test("renders both required shared fields with their labels", () => {
  const html = renderToStaticMarkup(
    <DailyReportSharedFields<Fields> register={stubRegister()} errors={{}} />,
  );

  assert.match(html, /Réalisé aujourd’hui \*/);
  assert.match(html, /Prévu demain \*/);
});

test("renders field errors when present", () => {
  const errors: FieldErrors<Fields> = {
    accomplishedToday: { type: "server", message: "Réalisé aujourd’hui est requis." },
  };

  const html = renderToStaticMarkup(
    <DailyReportSharedFields<Fields> register={stubRegister()} errors={errors} />,
  );

  assert.match(html, /Réalisé aujourd’hui est requis\./);
});
