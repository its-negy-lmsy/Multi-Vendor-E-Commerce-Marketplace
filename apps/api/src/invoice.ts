export type InvoiceData = {
  invoiceNumber: string;
  orderId: string;
  orderDate: Date;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: {
      recipient: string;
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      phone?: string;
    };
  };
  vendor: {
    shopName: string;
    slug?: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    unitPricePaise: number;
    totalPaise: number;
  }>;
  subtotalPaise: number;
  discountPaise: number;
  totalPaise: number;
  paymentReference: string;
  paymentStatus: string;
};

export function renderInvoiceHtml(invoice: InvoiceData): string {
  const formatInr = (paise: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);

  const dateStr = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(invoice.orderDate));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${invoice.invoiceNumber}</title>
  <style>
    @page { size: A4; margin: 18mm 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 24px; font-size: 13px; line-height: 1.5; background: #fff; }
    .invoice-card { max-width: 800px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 36px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 20px; }
    .brand { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #111827; }
    .brand span { color: #50684d; }
    .invoice-badge { text-align: right; }
    .invoice-badge h1 { margin: 0 0 4px; font-size: 20px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-sub { font-size: 12px; color: #6b7280; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin: 28px 0; }
    .info-block h3 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #6b7280; font-weight: 600; }
    .info-block p { margin: 0 0 4px; color: #374151; }
    .table-container { margin: 28px 0; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f9fafb; text-align: left; padding: 12px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #4b5563; border-bottom: 1px solid #e5e7eb; }
    td { padding: 14px; border-bottom: 1px solid #f3f4f6; color: #1f2937; }
    .text-right { text-align: right; }
    .totals-area { display: flex; justify-content: flex-end; margin-top: 16px; }
    .totals-box { width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #4b5563; }
    .totals-row.grand-total { border-top: 2px solid #111827; margin-top: 8px; padding-top: 10px; font-size: 16px; font-weight: 700; color: #111827; }
    .footer { margin-top: 48px; border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 11px; color: #9ca3af; text-align: center; }
    .print-btn { background: #50684d; color: #fff; border: 0; padding: 9px 18px; border-radius: 6px; font-weight: 600; cursor: pointer; margin-bottom: 20px; }
    @media print { .print-btn { display: none; } .invoice-card { border: none; padding: 0; box-shadow: none; } }
  </style>
</head>
<body>
  <div style="max-width: 800px; margin: 0 auto; text-align: right;">
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="invoice-card">
    <div class="header-row">
      <div>
        <div class="brand">Common<span>Goods</span>.</div>
        <div style="color: #6b7280; font-size: 12px; margin-top: 4px;">Multi-Vendor Marketplace Platform</div>
        <div style="color: #9ca3af; font-size: 11px;">Platform GSTIN: 07AAACH1234D1Z2</div>
      </div>
      <div class="invoice-badge">
        <h1>Tax Invoice</h1>
        <div class="badge-sub">Invoice #: <strong>${invoice.invoiceNumber}</strong></div>
        <div class="badge-sub">Date: ${dateStr}</div>
        <div class="badge-sub">Payment Ref: <code>${invoice.paymentReference}</code></div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-block">
        <h3>Billed / Shipped To:</h3>
        <p><strong>${invoice.customer.address.recipient}</strong></p>
        <p>${invoice.customer.address.line1}${invoice.customer.address.line2 ? ', ' + invoice.customer.address.line2 : ''}</p>
        <p>${invoice.customer.address.city}, ${invoice.customer.address.state} - ${invoice.customer.address.postalCode}</p>
        <p>${invoice.customer.address.country}</p>
        <p>Phone: ${invoice.customer.address.phone}</p>
      </div>
      <div class="info-block">
        <h3>Sold By (Vendor):</h3>
        <p><strong>${invoice.vendor.shopName}</strong></p>
        <p>Order ID: ${invoice.orderId}</p>
        <p>Payment Status: <span style="display:inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: #e0f2fe; color: #0369a1;">${invoice.paymentStatus}</span></p>
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width: 50%;">Item Description</th>
            <th class="text-right">Unit Price</th>
            <th class="text-right" style="width: 15%;">Qty</th>
            <th class="text-right" style="width: 20%;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.items
            .map(
              item => `
          <tr>
            <td><strong>${item.name}</strong></td>
            <td class="text-right">${formatInr(item.unitPricePaise)}</td>
            <td class="text-right">${item.quantity}</td>
            <td class="text-right"><strong>${formatInr(item.totalPaise)}</strong></td>
          </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>

    <div class="totals-area">
      <div class="totals-box">
        <div class="totals-row">
          <span>Items Subtotal:</span>
          <span>${formatInr(invoice.subtotalPaise)}</span>
        </div>
        ${
          invoice.discountPaise > 0
            ? `
        <div class="totals-row" style="color: #16a34a;">
          <span>Coupon Discount:</span>
          <span>-${formatInr(invoice.discountPaise)}</span>
        </div>
        `
            : ''
        }
        <div class="totals-row">
          <span>Shipping:</span>
          <span style="color: #16a34a; font-weight: 600;">FREE</span>
        </div>
        <div class="totals-row grand-total">
          <span>Total Paid:</span>
          <span>${formatInr(invoice.totalPaise)}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      This is a system-generated invoice. Registered under Common Goods Marketplace Platform.
    </div>
  </div>
</body>
</html>`;
}
