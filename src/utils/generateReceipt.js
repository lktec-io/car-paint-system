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
  const W = doc.internal.pageSize.getWidth();

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

  doc.setFillColor(46, 204, 113);
  doc.roundedRect(W / 2 - 12, 25, 24, 8, 2, 2, 'F');
  doc.setTextColor(15, 25, 35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('✓  PAID', W / 2, 30.5, { align: 'center' });

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(8.5);

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  doc.text(`Receipt #: ${sale.sale_number || 'N/A'}`, 12, 46);
  doc.text(`Date: ${fmtDate(sale.sale_date)}`, 12, 52);
  doc.text(`Time: ${timeStr}`, 12, 58);

  autoTable(doc, {
    startY: 67,
    head: [['Description', 'Qty', 'Unit Price', 'Amount']],
    body: (items || []).map(it => [
      it.description || it.item_name || '—',
      String(parseFloat(it.quantity || 0)),
      money(it.unit_price),
      money(it.total || (it.quantity * it.unit_price)),
    ]),
  });

  const finalY = (doc.lastAutoTable?.finalY ?? 130) + 6;

  doc.setFillColor(13, 27, 42);
  doc.roundedRect(12, finalY, W - 24, 13, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(`TOTAL: ${money(sale.total_amount)}`, W - 18, finalY + 8.5, { align: 'right' });

  doc.save(`Receipt-${sale.sale_number || 'sale'}.pdf`);
}

/* ── WhatsApp MESSAGE ────────────────────────────────────────── */
export function buildWhatsAppMessage(sale, items) {
  const lines = (items || []).map(it => {
    const name = it.description || it.item_name || 'Item';
    const qty = Number(it.quantity || 0);
    const total = it.total || qty * it.unit_price;

    return `• ${name} x${qty} = ${money(total)}`;
  });

  return [
    `Hello 👋 Here is your receipt from *Silas Paint Store*`,
    '',
    `🧾 Receipt #${sale.sale_number || 'N/A'}`,
    `📅 Date: ${fmtDate(sale.sale_date)}`,
    `💳 Payment: ${(sale.payment_method || 'cash').toUpperCase()} ✅`,
    '',
    '*Items:*',
    ...lines,
    '',
    `💰 TOTAL: ${money(sale.total_amount)}`,
    '',
    'Thank you for your business 🎨',
  ].join('\n');
}

/* ── PHONE NORMALIZER ───────────────────────────────────────── */
export function normalisePhone(rawPhone) {
  const digits = String(rawPhone).replace(/\D/g, '');

  if (digits.startsWith('0')) return '255' + digits.slice(1);
  if (digits.startsWith('255')) return digits;
  if (digits.length === 9) return '255' + digits;

  return digits;
}

/* ── WHATSAPP URL (FIXED CORE) ──────────────────────────────── */
export function buildWhatsAppUrl(phone, message) {
  const number = normalisePhone(phone);
  const text = encodeURIComponent(message);

  // IMPORTANT: ONLY wa.me (works for Messenger + Business)
  return `https://wa.me/${number}?text=${text}`;
}

/* ── OPEN WHATSAPP ──────────────────────────────────────────── */
export function openWhatsApp(phone, message) {
  const url = buildWhatsAppUrl(phone, message);

  // safer open (prevents popup blocking issues)
  const win = window.open(url, '_blank', 'noopener,noreferrer');

  if (!win) {
    // fallback if popup blocked
    window.location.href = url;
  }
}