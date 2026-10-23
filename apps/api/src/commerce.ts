export type PricedLine = { unitPricePaise: number; quantity: number };
export function calculateTotals(lines: PricedLine[], commissionBps: number) {
  if (!Number.isSafeInteger(commissionBps) || commissionBps < 0 || commissionBps > 10000) throw new RangeError('commissionBps must be between 0 and 10000');
  return lines.reduce((total, line) => {
    if (!Number.isSafeInteger(line.unitPricePaise) || line.unitPricePaise < 0 || !Number.isSafeInteger(line.quantity) || line.quantity < 1) throw new RangeError('Line prices and quantities must be valid integers');
    const linePaise = line.unitPricePaise * line.quantity;
    const commissionPaise = Math.floor(linePaise * commissionBps / 10000);
    return { subtotalPaise: total.subtotalPaise + linePaise, commissionPaise: total.commissionPaise + commissionPaise };
  }, { subtotalPaise: 0, commissionPaise: 0 });
}

export function canTransitionOrder(from: string, to: string): boolean {
  const transitions: Record<string, string[]> = {
    PAYMENT_PENDING: ['PLACED', 'CANCELLED'],
    PLACED: ['PACKED', 'CANCELLED'],
    PACKED: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED'],
    DELIVERED: ['REFUNDED'],
    CANCELLED: [], REFUNDED: [],
  };
  return transitions[from]?.includes(to) ?? false;
}
