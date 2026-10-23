import { describe, expect, it } from 'vitest';
import { formatPrice } from './utils';

describe('formatPrice', () => {
  it('formats integer paise as Indian rupees without floating point arithmetic', () => {
    expect(formatPrice(149900)).toBe('₹1,499');
  });
  it('formats a zero amount', () => {
    expect(formatPrice(0)).toBe('₹0');
  });
});
