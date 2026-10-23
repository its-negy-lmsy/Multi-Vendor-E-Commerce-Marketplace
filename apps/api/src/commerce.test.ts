import { describe, expect, it } from 'vitest';
import { calculateTotals, canTransitionOrder } from './commerce.js';

describe('commerce calculations and state transitions', () => {
  it('calculates item totals and commission in integer paise', () => {
    expect(calculateTotals([{ unitPricePaise: 149900, quantity: 2 }, { unitPricePaise: 89900, quantity: 1 }], 1000)).toEqual({ subtotalPaise: 389700, commissionPaise: 38970 });
  });
  it('rejects invalid commission and quantities', () => {
    expect(() => calculateTotals([{ unitPricePaise: 1000, quantity: 1 }], 10001)).toThrow(RangeError);
    expect(() => calculateTotals([{ unitPricePaise: 1000, quantity: 0 }], 1000)).toThrow(RangeError);
  });
  it('only allows forward order transitions', () => {
    expect(canTransitionOrder('PLACED', 'PACKED')).toBe(true);
    expect(canTransitionOrder('DELIVERED', 'PLACED')).toBe(false);
  });
});
