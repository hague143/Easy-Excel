// Keep ordinary results readable without rounding nonzero research results to zero.
export function formatResultNumber(value: number, locale?: string): string {
  const magnitude = Math.abs(value);
  return magnitude !== 0 && (magnitude < 1e-6 || magnitude >= 1e15)
    ? new Intl.NumberFormat(locale, {
        notation: 'scientific',
        maximumSignificantDigits: 12,
      }).format(value)
    : new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(value);
}
