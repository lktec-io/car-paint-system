import { useState, useEffect, useCallback } from 'react';
import { MdAdd, MdVisibility, MdPayment } from 'react-icons/md';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';

const STATUS_CLASS = { sent: 'badge-info', partial: 'badge-warning', paid: 'badge-success', overdue: 'badge-danger', draft: 'badge-neutral' };

const COLS = [
  { key: 'invoice_number', label: 'Invoice #' },
  { key: 'customer_name',  label: 'Customer',  render: v => v || 'Walk-in' },
  { key: 'invoice_date',   label: 'Date',      render: v => formatDate(v) },
  { key: 'due_date',       label: 'Due',       render: v => formatDate(v) },
  { key: 'total_amount',   label: 'Total',     render: v => <b>{formatCurrency(v)}</b> },
  { key: 'amount_paid',    label: 'Paid',      render: v => formatCurrency(v) },
  { key: 'status', label: 'Status',
    render: v => <span className={`badge ${STATUS_CLASS[v] || 'badge-neutral'}`}>{v}</span> },
];

const blankItem = () => ({ description: '', quantity: '1', unit_price: '', inventory_item_id: '' });

function blankForm() {
  const today = new Date().toISOString().split('T')[0];
  const due   = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  return { customer_id: '', invoice_date: today, due_date: due, discount_percent: '0', tax_percent: '0', payment_method: 'cash', notes: '', items: [blankItem()] };
}

export default function InvoicesPage() {
  const addToast = useUiStore(s => s.addToast);
  const [rows, setRows]           = useState([]);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewInv, setViewInv]     = useState(null);
  const [payOpen, setPayOpen]     = useState(null);
  const [saving, setSaving]       = useState(false);
  const [payAmt, setPayAmt]       = useState('');
  const [form, setForm]           = useState(blankForm());

  const load = useCallback(async () => {
    try {
      const [inv, cust, items] = await Promise.all([
        api.get('/invoices'), api.get('/customers'), api.get('/inventory'),
      ]);
      setRows(inv.data.data);
      setCustomers(cust.data.data);
      setInventory(items.data.data);
    } catch { addToast({ type: 'error', message: 'Failed to load data' }); }
    finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm(blankForm()); setCreateOpen(true); }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function setItem(idx, k, v) {
    setForm(f => {
      const items = f.items.map((it, i) => i === idx ? { ...it, [k]: v } : it);
      if (k === 'inventory_item_id' && v) {
        const inv = inventory.find(i => String(i.id) === String(v));
        if (inv) items[idx] = { ...items[idx], description: inv.item_name, unit_price: String(inv.unit_cost) };
      }
      return { ...f, items };
    });
  }

  function addItem()      { setForm(f => ({ ...f, items: [...f.items, blankItem()] })); }
  function removeItem(i)  { setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) })); }

  const subtotal = form.items.reduce((s, it) => s + (parseFloat(it.quantity)||0) * (parseFloat(it.unit_price)||0), 0);
  const disc     = subtotal * (parseFloat(form.discount_percent||0) / 100);
  const tax      = (subtotal - disc) * (parseFloat(form.tax_percent||0) / 100);
  const total    = subtotal - disc + tax;

  async function save() {
    if (!form.invoice_date || !form.due_date) return addToast({ type: 'error', message: 'Date fields required' });
    if (form.items.some(it => !it.description || !it.quantity || !it.unit_price)) return addToast({ type: 'error', message: 'Fill all line items' });
    setSaving(true);
    try {
      const payload = { ...form, items: form.items.map(it => ({ ...it, inventory_item_id: it.inventory_item_id || null, quantity: parseFloat(it.quantity), unit_price: parseFloat(it.unit_price) })) };
      await api.post('/invoices', payload);
      addToast({ type: 'success', message: 'Invoice created' });
      setCreateOpen(false); load();
    } catch (err) { addToast({ type: 'error', message: err.response?.data?.error || 'Create failed' }); }
    finally { setSaving(false); }
  }

  async function recordPayment() {
    if (!payAmt || parseFloat(payAmt) <= 0) return addToast({ type: 'error', message: 'Enter a valid amount' });
    setSaving(true);
    try {
      await api.post(`/invoices/${payOpen.id}/payment`, { amount: parseFloat(payAmt) });
      addToast({ type: 'success', message: 'Payment recorded' });
      setPayOpen(null); setPayAmt(''); load();
    } catch (err) { addToast({ type: 'error', message: err.response?.data?.error || 'Payment failed' }); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Invoices</h2>
        <button className="btn btn-primary" onClick={openCreate}><MdAdd /> New Invoice</button>
      </div>

      <DataTable columns={COLS} data={rows} loading={loading} searchable searchPlaceholder="Search invoices…"
        actions={r => (<>
          <button className="btn-icon" title="View" onClick={() => setViewInv(r)}><MdVisibility /></button>
          {r.status !== 'paid' && <button className="btn-icon" title="Record Payment" style={{ color: 'var(--color-accent-green)' }} onClick={() => { setPayOpen(r); setPayAmt(''); }}><MdPayment /></button>}
        </>)}
      />

      {/* Create Invoice Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Invoice" size="lg"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Creating…' : 'Create Invoice'}</button>
        </>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-row">
            <FormField label="Customer" htmlFor="inv-cust">
              <select id="inv-cust" value={form.customer_id} onChange={e => setField('customer_id', e.target.value)}>
                <option value="">Walk-in / No customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Payment Method" htmlFor="inv-pm">
              <select id="inv-pm" value={form.payment_method} onChange={e => setField('payment_method', e.target.value)}>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="mobile">Mobile Money</option>
                <option value="credit">Credit</option>
              </select>
            </FormField>
          </div>
          <div className="form-row">
            <FormField label="Invoice Date" htmlFor="inv-date" required><input id="inv-date" type="date" value={form.invoice_date} onChange={e => setField('invoice_date', e.target.value)} /></FormField>
            <FormField label="Due Date" htmlFor="inv-due" required><input id="inv-due" type="date" value={form.due_date} onChange={e => setField('due_date', e.target.value)} /></FormField>
          </div>

          {/* Line items */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Line Items</label>
              <button className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }} onClick={addItem}><MdAdd /> Add Row</button>
            </div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead style={{ background: 'var(--color-bg-tertiary)' }}>
                  <tr>
                    {['Inventory Item', 'Description', 'Qty', 'Unit Price', 'Total', ''].map(h => (
                      <th key={h} style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.35rem 0.5rem' }}>
                        <select value={it.inventory_item_id} onChange={e => setItem(idx, 'inventory_item_id', e.target.value)} style={{ width: 130 }}>
                          <option value="">— none —</option>
                          {inventory.map(i => <option key={i.id} value={i.id}>{i.item_name}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '0.35rem 0.5rem' }}><input value={it.description} onChange={e => setItem(idx, 'description', e.target.value)} placeholder="Description" style={{ width: 160 }} /></td>
                      <td style={{ padding: '0.35rem 0.5rem' }}><input type="number" min="1" value={it.quantity} onChange={e => setItem(idx, 'quantity', e.target.value)} style={{ width: 60 }} /></td>
                      <td style={{ padding: '0.35rem 0.5rem' }}><input type="number" min="0" step="0.01" value={it.unit_price} onChange={e => setItem(idx, 'unit_price', e.target.value)} style={{ width: 90 }} /></td>
                      <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600 }}>{formatCurrency((parseFloat(it.quantity)||0)*(parseFloat(it.unit_price)||0))}</td>
                      <td style={{ padding: '0.35rem 0.5rem' }}>
                        {form.items.length > 1 && <button className="btn-icon" style={{ color: 'var(--color-accent-red)', fontSize: '1rem' }} onClick={() => removeItem(idx)}>✕</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="form-row">
            <FormField label="Discount %" htmlFor="inv-disc"><input id="inv-disc" type="number" min="0" max="100" step="0.01" value={form.discount_percent} onChange={e => setField('discount_percent', e.target.value)} /></FormField>
            <FormField label="Tax %" htmlFor="inv-tax"><input id="inv-tax" type="number" min="0" max="100" step="0.01" value={form.tax_percent} onChange={e => setField('tax_percent', e.target.value)} /></FormField>
          </div>
          <FormField label="Notes" htmlFor="inv-notes"><textarea id="inv-notes" rows={2} value={form.notes} onChange={e => setField('notes', e.target.value)} /></FormField>

          <div style={{ textAlign: 'right', padding: '0.75rem', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius)', fontSize: '0.88rem' }}>
            <div>Subtotal: {formatCurrency(subtotal)}</div>
            {disc > 0 && <div style={{ color: 'var(--color-accent-green)' }}>Discount: −{formatCurrency(disc)}</div>}
            {tax > 0 && <div>Tax: +{formatCurrency(tax)}</div>}
            <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '0.35rem' }}>Total: {formatCurrency(total)}</div>
          </div>
        </div>
      </Modal>

      {/* View Invoice Modal */}
      {viewInv && (
        <Modal open={!!viewInv} onClose={() => setViewInv(null)} title={`Invoice ${viewInv.invoice_number}`} size="md"
          footer={<button className="btn btn-secondary" onClick={() => setViewInv(null)}>Close</button>}
        >
          <div style={{ fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="form-row">
              <div><b>Customer:</b> {viewInv.customer_name || 'Walk-in'}</div>
              <div><b>Status:</b> <span className={`badge ${STATUS_CLASS[viewInv.status]||'badge-neutral'}`}>{viewInv.status}</span></div>
            </div>
            <div className="form-row">
              <div><b>Date:</b> {formatDate(viewInv.invoice_date)}</div>
              <div><b>Due:</b> {formatDate(viewInv.due_date)}</div>
            </div>
            <div className="form-row">
              <div><b>Total:</b> {formatCurrency(viewInv.total_amount)}</div>
              <div><b>Paid:</b> {formatCurrency(viewInv.amount_paid)}</div>
            </div>
            <div><b>Balance:</b> <span style={{ color: 'var(--color-accent-orange)', fontWeight: 600 }}>{formatCurrency(parseFloat(viewInv.total_amount) - parseFloat(viewInv.amount_paid))}</span></div>
            {viewInv.notes && <div><b>Notes:</b> {viewInv.notes}</div>}
          </div>
        </Modal>
      )}

      {/* Record Payment Modal */}
      <Modal open={!!payOpen} onClose={() => setPayOpen(null)} title="Record Payment" size="sm"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setPayOpen(null)} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={recordPayment} disabled={saving}>{saving ? 'Saving…' : 'Record'}</button>
        </>}
      >
        {payOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary)' }}>
              Invoice: <b>{payOpen.invoice_number}</b> — Balance: <b>{formatCurrency(parseFloat(payOpen.total_amount) - parseFloat(payOpen.amount_paid))}</b>
            </p>
            <FormField label="Amount Received" required htmlFor="pay-amt">
              <input id="pay-amt" type="number" min="0.01" step="0.01" value={payAmt} onChange={e => setPayAmt(e.target.value)} autoFocus />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  );
}
