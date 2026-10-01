import { describe, expect, it } from 'vitest';
import { coursePayablePrice, normaliseSalePrice } from './course-price';

describe('course sale price', () => {
  it('charges the sale price when it is below the main price', () => {
    expect(coursePayablePrice({ price: 999, salePrice: 500 })).toBe(500);
  });

  it('charges the main price when there is no valid sale', () => {
    expect(coursePayablePrice({ price: 999, salePrice: null })).toBe(999);
    expect(coursePayablePrice({ price: 999 })).toBe(999);
    expect(coursePayablePrice({ price: 999, salePrice: 999 })).toBe(999);
    expect(coursePayablePrice({ price: 999, salePrice: 1200 })).toBe(999);
  });

  it('clears empty, negative or too-high sale prices when saving', () => {
    expect(normaliseSalePrice('', 999)).toBeNull();
    expect(normaliseSalePrice(-5, 999)).toBeNull();
    expect(normaliseSalePrice(999, 999)).toBeNull();
    expect(normaliseSalePrice('500', 999)).toBe(500);
    expect(normaliseSalePrice(100, 0)).toBeNull();
  });
});
