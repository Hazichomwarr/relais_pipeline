import assert from "node:assert/strict";
import test from "node:test";

import {
  getProductDirectoryConfig,
  getProductDirectoryHref,
  getProductDirectorySlug,
  getProductFromDirectorySlug,
  listProductDirectoryConfigs,
} from "./product-directory";

test("maps every current RELAIS product to its expected slug", () => {
  assert.equal(getProductDirectorySlug("KARMDA"), "karmda");
  assert.equal(getProductDirectorySlug("DIGITAL_SERVICES"), "digital-services");
  assert.equal(getProductDirectorySlug("LOKARI"), "lokari");
  assert.equal(getProductDirectorySlug("NIA"), "nia");
});

test("resolves a slug back to its product", () => {
  assert.equal(getProductFromDirectorySlug("karmda"), "KARMDA");
  assert.equal(getProductFromDirectorySlug("digital-services"), "DIGITAL_SERVICES");
  assert.equal(getProductFromDirectorySlug("lokari"), "LOKARI");
  assert.equal(getProductFromDirectorySlug("nia"), "NIA");
});

test("an unknown slug resolves to null, not a thrown error", () => {
  assert.equal(getProductFromDirectorySlug("not-a-real-product"), null);
  assert.equal(getProductFromDirectorySlug(""), null);
});

test("builds the product directory href from the slug", () => {
  assert.equal(getProductDirectoryHref("KARMDA"), "/products/karmda");
  assert.equal(
    getProductDirectoryHref("DIGITAL_SERVICES"),
    "/products/digital-services",
  );
});

test("every configured product has a non-empty label and description", () => {
  for (const config of listProductDirectoryConfigs()) {
    assert.ok(config.label.trim().length > 0, `${config.product} has no label`);
    assert.ok(
      config.description.trim().length > 0,
      `${config.product} has no description`,
    );
  }
});

test("slugs are unique across all configured products", () => {
  const slugs = listProductDirectoryConfigs().map((config) => config.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test("products are unique across the configured list", () => {
  const products = listProductDirectoryConfigs().map((config) => config.product);
  assert.equal(new Set(products).size, products.length);
});

test("lists all four current RELAIS products", () => {
  const products = listProductDirectoryConfigs().map((config) => config.product);
  assert.deepEqual(
    [...products].sort(),
    ["DIGITAL_SERVICES", "KARMDA", "LOKARI", "NIA"].sort(),
  );
});

test("uses a deterministic, deliberate display order — KARMDA first, then Digital Services, LOKARI, NIA", () => {
  const products = listProductDirectoryConfigs().map((config) => config.product);
  assert.deepEqual(products, ["KARMDA", "DIGITAL_SERVICES", "LOKARI", "NIA"]);
});

test("getProductDirectoryConfig returns the full config for a single product", () => {
  const config = getProductDirectoryConfig("LOKARI");

  assert.equal(config.product, "LOKARI");
  assert.equal(config.slug, "lokari");
  assert.equal(config.label, "LOKARI");
});
