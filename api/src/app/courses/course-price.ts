/**
 * Courses have a main price and an optional sale price (like WooCommerce's
 * regular and sale price). The sale price only counts when it is below the
 * main price; checkout charges it and cards show the main price struck through.
 */
export function normaliseSalePrice(value: unknown, price: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const sale = Number(value);
  if (!Number.isFinite(sale) || sale < 0 || sale >= price) return null;
  return sale;
}

/** The amount a student pays for a course before coupons. */
export function coursePayablePrice(course: { price: unknown; salePrice?: unknown }): number {
  const price = Number(course.price);
  return normaliseSalePrice(course.salePrice, price) ?? price;
}
