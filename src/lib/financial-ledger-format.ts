/**
 * Presentation only — never use the return value for arithmetic. Operates
 * on the Decimal-serialized string directly (no Number() conversion) so
 * arbitrarily large CFA amounts never lose precision while formatting.
 */
export function formatXofAmount(amount: string): string {
  const trimmed = amount.trim();
  const isNegative = trimmed.startsWith("-");
  const unsigned = isNegative ? trimmed.slice(1) : trimmed;
  const [integerPart] = unsigned.split(".");
  const digitsOnly = integerPart.replace(/[^0-9]/g, "") || "0";
  const grouped = digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  return `${isNegative ? "-" : ""}${grouped} CFA`;
}
