import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ── Helpers ─────────────────────────────────────────────────── */
function money(n) {
  return 'TZS ' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── PDF Receipt ─────────────────────────────────────────────── */
export function downloadReceiptPDF(sale, items) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth(); // 148 mm for A5

  // ── Dark header ──────────────────────────────────────────────
  doc.setFillColor(13, 27, 42);
  doc.rect(0, 0, W, 38, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SILAS PAINT STORE', W / 2, 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(160, 190, 210);
  doc.text('Official Sales Receipt  ·  Dar es Salaam, Tanzania', W / 2, 21, { align: 'center' });

  // Paid badge
  doc.setFillColor(46, 204, 113);
  doc.roundedRect(W / 2 - 12, 25, 24, 8, 2, 2, 'F');
  doc.setTextColor(15, 25, 35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('✓  PAID', W / 2, 30.5, { align: 'center' });

  // ── Receipt details ──────────────────────────────────────────
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  doc.setFont('helvetica', 'bold');
  doc.text('Receipt #', 12, 46);
  doc.text('Date', 12, 52);
  doc.text('Time', 12, 58);
  doc.text('Payment', W / 2 + 4, 46);
  doc.text('Cashier', W / 2 + 4, 52);

  doc.setFont('helvetica', 'normal');
  doc.text(sale.sale_number || 'N/A', 38, 46);
  doc.text(fmtDate(sale.sale_date), 38, 52);
  doc.text(timeStr, 38, 58);
  doc.text((sale.payment_method || 'cash').toUpperCase(), W - 12, 46, { align: 'right' });
  doc.text(sale.created_by_name || '—', W - 12, 52, { align: 'right' });

  // ── Thin divider ─────────────────────────────────────────────
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.3);
  doc.line(12, 63, W - 12, 63);

  // ── Items table ──────────────────────────────────────────────
  autoTable(doc, {
    startY: 67,
    head: [['Description', 'Qty', 'Unit Price', 'Amount']],
    body: (items || []).map(it => [
      it.description || it.item_name || '—',
      String(parseFloat(it.quantity || 0)),
      money(it.unit_price),
      money(it.total != null ? it.total : parseFloat(it.quantity || 0) * parseFloat(it.unit_price || 0)),
    ]),
    styles: {
      fontSize: 8,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      textColor: [40, 40, 40],
      lineColor: [230, 233, 236],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [13, 27, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 14 },
      2: { halign: 'right', cellWidth: 32 },
      3: { halign: 'right', cellWidth: 32, fontStyle: 'bold' },
    },
    margin: { left: 12, right: 12 },
  });

  const finalY = (doc.lastAutoTable?.finalY ?? 130) + 6;

  // ── Total bar ────────────────────────────────────────────────
  doc.setFillColor(13, 27, 42);
  doc.roundedRect(12, finalY, W - 24, 13, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('TOTAL AMOUNT', 18, finalY + 8.5);
  doc.text(money(sale.total_amount), W - 18, finalY + 8.5, { align: 'right' });

  // ── Notes ────────────────────────────────────────────────────
  if (sale.notes) {
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.text(`Note: ${sale.notes}`, 12, finalY + 20);
  }

  // ── Footer ───────────────────────────────────────────────────
  const footerY = finalY + (sale.notes ? 30 : 22);
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.3);
  doc.line(12, footerY - 4, W - 12, footerY - 4);

  doc.setTextColor(130, 140, 150);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Thank you for shopping at Silas Paint Store!', W / 2, footerY, { align: 'center' });
  doc.text('For inquiries, contact us on WhatsApp', W / 2, footerY + 5, { align: 'center' });

  doc.save(`Receipt-${sale.sale_number || 'sale'}.pdf`);
}

/* ── WhatsApp message builder ────────────────────────────────── */
export function buildWhatsAppMessage(sale, items) {
  const lines = (items || []).map(it => {
    const name  = it.description || it.item_name || 'Item';
    const qty   = parseFloat(it.quantity || 0);
    const total = parseFloat(it.total != null ? it.total : qty * parseFloat(it.unit_price || 0));
    return `  • ${name} x${qty} = ${money(total)}`;
  });

  return [
    `Hello! 👋 Here is your receipt from *Silas Paint Store*`,
    '',
    `🧾 *Receipt #${sale.sale_number || 'N/A'}*`,
    `📅 Date: ${fmtDate(sale.sale_date)}`,
    `💳 Payment: ${(sale.payment_method || 'cash').toUpperCase()} ✅ Paid`,
    '',
    '*Items Purchased:*',
    ...lines,
    '',
    `💰 *TOTAL: ${money(sale.total_amount)}*`,
    '',
    '_Thank you for your business! 🎨_',
    '_Silas Paint Store — Dar es Salaam_',
  ].join('\n');
}

/* ── Open WhatsApp ───────────────────────────────────────────── */
export function openWhatsApp(rawPhone, message) {
  let p = rawPhone.replace(/\D/g, ''); // strip all non-digits
  if (p.startsWith('0') && p.length >= 10) p = '255' + p.slice(1);   // 07xx → 2557xx
  if (p.length === 9) p = '255' + p;                                   // 7xx  → 2557xx
  if (p.startsWith('+')) p = p.slice(1);
  const url = `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
