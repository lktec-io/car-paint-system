import { forwardRef } from 'react';

/* ─────────────────────────────────────────────────────────────
   SaleReceiptTemplate
   Pure HTML/CSS receipt layout for html2canvas → PNG export.

   Rules:
   • ALL styles are inline — no CSS variables, no external sheets
   • Fixed 520 px width so html2canvas never overflows
   • White background (#ffffff) throughout
   • No box-shadows that html2canvas mis-renders
   ───────────────────────────────────────────────────────────── */

const BRAND   = '#0d1b2a';   // dark navy — header / total bar bg
const ACCENT  = '#16a34a';   // forest green — paid badge / accents
const TEXT1   = '#111827';   // near-black body text
const TEXT2   = '#6b7280';   // muted labels
const BORDER  = '#e5e7eb';   // light grey dividers
const ROWALT  = '#f9fafb';   // alternating table row bg

const PAYMENT_LABEL = {
  cash:   'Cash',
  mobile: 'Mobile Money',
  bank:   'Bank Transfer',
  credit:  'Credit',
};

function money(n) {
  return 'TZS ' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const SaleReceiptTemplate = forwardRef(function SaleReceiptTemplate({ sale = {}, items = [] }, ref) {
  const saleTotal = parseFloat(sale.total_amount || 0);

  return (
    <div
      ref={ref}
      style={{
        width: 520,
        backgroundColor: '#ffffff',
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        color: TEXT1,
        fontSize: 13,
        lineHeight: 1.5,
        /* outer padding so content never touches edge */
        padding: 0,
        boxSizing: 'border-box',
      }}
    >
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: BRAND,
          padding: '32px 36px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        {/* Company info */}
        <div>
          {/* Paint-bucket icon — pure CSS, no images needed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 36, height: 36,
              backgroundColor: ACCENT,
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 18, height: 18,
                border: '3px solid #ffffff',
                borderRadius: '50%',
              }} />
            </div>
            <span style={{ color: '#ffffff', fontWeight: 800, fontSize: 17, letterSpacing: 0.3 }}>
              SILAS PAINT STORE
            </span>
          </div>
          <p style={{ color: '#9ca3af', fontSize: 12, margin: 0 }}>Mbeya, Tanzania</p>
          <p style={{ color: '#9ca3af', fontSize: 12, margin: '2px 0 0' }}>
            WhatsApp: +255 XXX XXX XXX
          </p>
        </div>

        {/* Paid badge */}
        <div style={{
          backgroundColor: ACCENT,
          color: '#ffffff',
          fontWeight: 700,
          fontSize: 13,
          padding: '6px 18px',
          borderRadius: 24,
          letterSpacing: 0.5,
          whiteSpace: 'nowrap',
          marginTop: 4,
        }}>
          ✓ PAID
        </div>
      </div>

      {/* ── RECEIPT TITLE STRIP ────────────────────────────────── */}
      <div style={{
        backgroundColor: '#f3f4f6',
        padding: '12px 36px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: TEXT1, textTransform: 'uppercase', letterSpacing: 1 }}>
          Sales Receipt
        </span>
        <span style={{ fontWeight: 700, fontSize: 14, color: BRAND }}>
          {sale.sale_number || '—'}
        </span>
      </div>

      {/* ── RECEIPT META ───────────────────────────────────────── */}
      <div style={{
        padding: '22px 36px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px 24px',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        {[
          ['Date',           fmtDate(sale.sale_date)],
          ['Payment Method', PAYMENT_LABEL[sale.payment_method] || (sale.payment_method || 'Cash')],
          ['Cashier',        sale.created_by_name || '—'],
          ['Status',         'Paid'],
        ].map(([label, value]) => (
          <div key={label}>
            <p style={{ margin: 0, fontSize: 11, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>
              {label}
            </p>
            <p style={{
              margin: '3px 0 0',
              fontSize: 13,
              fontWeight: 600,
              color: label === 'Status' ? ACCENT : TEXT1,
            }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* ── ITEMS TABLE ────────────────────────────────────────── */}
      <div style={{ padding: '0 36px' }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 60px 100px 100px',
          padding: '10px 0',
          borderBottom: `2px solid ${BRAND}`,
          marginTop: 22,
        }}>
          {['Description', 'Qty', 'Unit Price', 'Amount'].map((h, i) => (
            <span key={h} style={{
              fontSize: 11,
              fontWeight: 700,
              color: BRAND,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              textAlign: i > 1 ? 'right' : (i === 1 ? 'center' : 'left'),
            }}>
              {h}
            </span>
          ))}
        </div>

        {/* Table rows */}
        {(items || []).map((it, idx) => {
          const qty   = parseFloat(it.quantity  || 0);
          const price = parseFloat(it.unit_price || 0);
          const amt   = parseFloat(it.total != null ? it.total : qty * price);
          const name  = it.description || it.item_name || '—';
          return (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 60px 100px 100px',
                padding: '11px 0',
                backgroundColor: idx % 2 === 1 ? ROWALT : '#ffffff',
                borderBottom: `1px solid ${BORDER}`,
              }}
            >
              <span style={{ fontSize: 13, color: TEXT1, fontWeight: 500 }}>{name}</span>
              <span style={{ fontSize: 13, color: TEXT2, textAlign: 'center' }}>{qty}</span>
              <span style={{ fontSize: 13, color: TEXT2, textAlign: 'right' }}>{money(price)}</span>
              <span style={{ fontSize: 13, color: TEXT1, fontWeight: 600, textAlign: 'right' }}>{money(amt)}</span>
            </div>
          );
        })}

        {items.length === 0 && (
          <p style={{ color: TEXT2, fontSize: 12, padding: '12px 0' }}>No items.</p>
        )}
      </div>

      {/* ── TOTAL BAR ──────────────────────────────────────────── */}
      <div style={{
        margin: '0 36px 28px',
        backgroundColor: BRAND,
        borderRadius: 10,
        padding: '18px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
      }}>
        <span style={{ color: '#9ca3af', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Total Amount
        </span>
        <span style={{ color: '#ffffff', fontSize: 22, fontWeight: 800, letterSpacing: 0.5 }}>
          {money(saleTotal)}
        </span>
      </div>

      {/* ── NOTES (optional) ───────────────────────────────────── */}
      {sale.notes && (
        <div style={{
          margin: '0 36px 20px',
          padding: '12px 16px',
          backgroundColor: '#fffbeb',
          border: `1px solid #fde68a`,
          borderRadius: 8,
        }}>
          <p style={{ margin: 0, fontSize: 11, color: '#92400e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Note
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#78350f' }}>{sale.notes}</p>
        </div>
      )}

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <div style={{
        borderTop: `1px solid ${BORDER}`,
        padding: '20px 36px 28px',
        textAlign: 'center',
      }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT1 }}>
          Thank you for your purchase!
        </p>
        <p style={{ margin: '5px 0 0', fontSize: 12, color: TEXT2 }}>
          Silas Paint Store — Mbeya, Tanzania
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: '#d1d5db' }}>
          {sale.sale_number || ''}
        </p>
      </div>
    </div>
  );
});

export default SaleReceiptTemplate;
