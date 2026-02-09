// src/utils/printInvoice.ts
import { Order, Buyer, Product } from '../types';

export const printInvoice = (order: any, buyer: any | null | undefined, products: Product[]) => {
  const invoiceWindow = window.open('', '_blank');
  if (!invoiceWindow) return;

  const getProduct = (id: string) => products.find(p => p.id === id);

  // Normalize order fields to handle both snake_case and camelCase
  const orderId = order.id;
  const orderDate = order.date;
  const orderStatus = order.status;
  const orderSubtotal = typeof order.subtotal === 'number' ? order.subtotal : parseFloat(order.subtotal);
  const orderTax = typeof order.tax === 'number' ? order.tax : parseFloat(order.tax);
  const orderTotal = typeof order.total === 'number' ? order.total : parseFloat(order.total);
  const orderAmountPaid = typeof order.amountPaid === 'number' ? order.amountPaid : 
                        typeof order.amount_paid === 'number' ? order.amount_paid : 
                        parseFloat(order.amountPaid || order.amount_paid || 0);
  const orderPaymentStatus = order.paymentStatus || order.payment_status || 'Unpaid';
  
  // Normalize items
  const orderItems = (order.items || []).map((item: any) => ({
    productId: item.productId || item.product_id,
    quantity: typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity),
    priceAtOrder: typeof item.priceAtOrder === 'number' ? item.priceAtOrder : 
                  parseFloat(item.price_at_order || item.priceAtOrder)
  }));

  // Calculate tax rate based on stored amounts
  const taxableAmount = orderTotal - orderTax;
  const taxRate = taxableAmount > 0 ? (orderTax / taxableAmount) * 100 : 0;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice #${orderId}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; -webkit-print-color-adjust: exact; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #f1f5f9; }
        .logo { font-size: 24px; font-weight: 900; color: #005A9C; display: flex; align-items: center; gap: 10px; }
        .invoice-title { font-size: 32px; font-weight: 900; text-transform: uppercase; color: #0f172a; letter-spacing: -1px; }
        .meta { margin-top: 10px; font-size: 13px; color: #64748b; font-weight: 500; line-height: 1.6; }
        .grid { display: flex; gap: 60px; margin-bottom: 40px; }
        .col { flex: 1; }
        .label { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; margin-bottom: 8px; }
        .value { font-size: 14px; font-weight: 600; color: #0f172a; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { text-align: left; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #64748b; letter-spacing: 1px; padding: 12px 0; border-bottom: 2px solid #e2e8f0; }
        td { padding: 16px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 500; color: #334155; }
        .text-right { text-align: right; }
        .totals { margin-left: auto; width: 300px; background: #f8fafc; padding: 20px; border-radius: 12px; }
        .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; color: #64748b; font-weight: 500; }
        .grand-total { font-size: 18px; font-weight: 900; color: #005A9C; border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 10px; }
        .status-stamp { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-top: 5px; }
        .paid { background: #dcfce7; color: #166534; }
        .unpaid { background: #fef3c7; color: #92400e; }
        .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">
            B2B Intel
          </div>
          <div class="meta">
            Wholesale Distribution HQ<br>
            Bole Road, Mega Building<br>
            Addis Ababa, Ethiopia<br>
            +251 911 000 000
          </div>
        </div>
        <div style="text-align: right;">
          <div class="invoice-title">Invoice</div>
          <div class="meta">
            <strong>#${orderId.replace('ORD-', '')}</strong><br>
            Date: ${orderDate}<br>
            <span class="status-stamp ${orderPaymentStatus === 'Paid' ? 'paid' : 'unpaid'}">${orderPaymentStatus || 'Unpaid'}</span>
          </div>
        </div>
      </div>

      <div class="grid">
        <div class="col">
          <div class="label">Bill To</div>
          <div class="value">
            ${buyer?.companyName || 'Unknown Buyer'}<br>
            <span style="font-weight: 400; color: #475569;">
              Attn: ${buyer?.contactPerson || ''}<br>
              ${buyer?.phone || ''}<br>
              ${buyer?.email || ''}
            </span>
          </div>
        </div>
        <div class="col">
          <div class="label">Ship To</div>
          <div class="value">
            ${buyer?.companyName || 'Unknown Buyer'}<br>
            <span style="font-weight: 400; color: #475569;">
              ${buyer?.address || 'Same as Billing Address'}
            </span>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th width="50%">Item Description</th>
            <th class="text-right" width="15%">Qty</th>
            <th class="text-right" width="15%">Unit Price</th>
            <th class="text-right" width="20%">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${orderItems.map(item => {
            const p = getProduct(item.productId);
            return `
              <tr>
                <td>
                  <div style="font-weight: 700; color: #0f172a;">${p?.name || 'Unknown Item'}</div>
                  <div style="font-size: 11px; color: #94a3b8; font-weight: 600;">SKU: ${p?.sku || '---'}</div>
                </td>
                <td class="text-right" style="font-weight: 700;">${item.quantity}</td>
                <td class="text-right">ETB ${item.priceAtOrder.toLocaleString()}</td>
                <td class="text-right" style="font-weight: 700;">ETB ${(item.quantity * item.priceAtOrder).toLocaleString()}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row">
          <span>Subtotal</span>
          <span>ETB ${orderSubtotal.toLocaleString()}</span>
        </div>
        <div class="total-row">
          <span>Tax (${taxRate.toFixed(0)}%)</span>
          <span>ETB ${orderTax.toLocaleString()}</span>
        </div>
        <div class="total-row grand-total">
          <span>Total</span>
          <span>ETB ${orderTotal.toLocaleString()}</span>
        </div>
        ${orderAmountPaid > 0 ? `
        <div class="total-row" style="margin-top: 10px; color: #166534; font-weight: 700;">
          <span>Amount Paid</span>
          <span>- ETB ${orderAmountPaid.toLocaleString()}</span>
        </div>
        <div class="total-row" style="font-weight: 900; color: #0f172a; font-size: 15px; margin-top: 5px;">
          <span>Balance Due</span>
          <span>ETB ${(orderTotal - orderAmountPaid).toLocaleString()}</span>
        </div>
        ` : ''}
      </div>

      <div class="footer">
        <p>Thank you for your business.</p>
        <p>Payment Terms: ${buyer?.paymentTerms || 'Net 30'} &bull; Please include invoice number on your payment.</p>
      </div>
      <script>
        window.print();
      </script>
    </body>
    </html>
  `;

  invoiceWindow.document.write(html);
  invoiceWindow.document.close();
};