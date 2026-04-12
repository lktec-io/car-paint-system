import { useState, useEffect, useCallback } from 'react';
import { MdAdd, MdVisibility, MdDelete } from 'react-icons/md';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import FormField from '../../components/common/FormField';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';

const PAYMENT_METHODS = [
  { value: 'cash',   label: 'Cash' },
  { value: 'mobile', label: 'Mobile Money' },
  { value: 'bank',   label: 'Bank Transfer' },
  { value: 'credit', label: 'Credit' },
];

const blankItem = () => ({ inventory_item_id: '', description: '', quantity: '1', unit_price: '' });

function blankForm() {
  return {
    sale_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    notes: '',
    items: [blankItem()],
  };
}

const COLS = [
  { key: 'sale_number',     label: 'Sale #',   render: v => <code style={{ fontSize: '0.8rem', color: 'var(--color-accent-blue)' }}>{v}</code> },
  { key: 'sale_date',       label: 'Date',      render: v => formatDate(v) },
  { key: 'item_count',      label: 'Items',     render: v => <span style={{ fontWeight: 600 }}>{v}</span> },
  { key: 'total_amount',    label: 'Total',     render: v => <b style={{ color: 'var(--color-accent-green)' }}>{formatCurrency(v)}</b> },
  { key: 'payment_method',  label: 'Method',    render: v => <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{v}</span> },
  { key: 'created_by_name', label: 'By' },
];

export default function SalesPage() {
  const addToast = useUiStore(s => s.addToast);
  const { user } = useAuth();
  const canCreate = ['super_admin', 'store_manager', 'sales_officer', 'accountant'].includes(user?.role);

  const [rows, setRows]           = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewSale, setViewSale]   = useState(null);
  const [viewItems, setViewItems] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState(blankForm());

  const load = useCallback(async () => {
    try {
      const [sales, inv] = await Promise.all([
        api.get('/sales'),
        api.get('/inventory'),
      ]);
      setRows(sales.data.data);
      setInventory(inv.data.data);
    } catch {
      addToast({ type: 'error', message: 'Failed to load sales data' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  async function openView(sale) {
    setViewSale(sale);
    setViewItems([]);
    setViewLoading(true);
    try {
      const { data } = await api.get(`/sales/${sale.id}`);
      setViewItems(data.data.items || []);
    } catch {
      addToast({ type: 'error', message: 'Failed to load sale details' });
    } finally {
      setViewLoading(false);
    }
  }

  function openCreate() { setForm(blankForm()); setCreateOpen(true); }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function setItem(idx, k, v) {
    setForm(f => {
      const items = f.items.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, [k]: v };
        // Auto-fill description and price when inventory item selected
        if (k === 'inventory_item_id' && v) {
          const inv = f._inv?.find(i => String(i.id) === String(v));
          if (inv) {
            updated.description = inv.item_name;
            updated.unit_price  = String(inv.unit_cost);
          }
        }
        return updated;
      });
      return { ...f, items };
    });
  }

  // Store inventory list in form state so setItem can access it
  useEffect(() => {
    setForm(f => ({ ...f, _inv: inventory }));
  }, [inventory]);

  function addItem()      { setForm(f => ({ ...f, items: [...f.items, blankItem()] })); }
  function removeItem(i)  { setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) })); }

  const total = form.items.reduce(
    (s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0
  );

  const isValid = form.sale_date &&
    form.items.length > 0 &&
    form.items.every(it => (it.description || it.inventory_item_id) && parseFloat(it.quantity) > 0 && parseFloat(it.unit_price) >= 0) &&
    total > 0;

  async function save() {
    if (!isValid) return addToast({ type: 'error', message: 'Fill all required fields' });
    setSaving(true);
    try {
      const payload = {
        sale_date:      form.sale_date,
        payment_method: form.payment_method,
        notes:          form.notes,
        items: form.items.map(it => ({
          inventory_item_id: it.inventory_item_id || null,
          description:       it.description,
          quantity:          parseFloat(it.quantity),
          unit_price:        parseFloat(it.unit_price),
        })),
      };
      await api.post('/sales', payload);
      addToast({ type: 'success', message: 'Sale recorded successfully' });
      setCreateOpen(false);
      load();
    } catch (err) {
      addToast({ type: 'error', message: err.response?.data?.error || 'Failed to record sale' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <h2>Sales</h2>
        {canCreate && (
          <button className="btn btn-primary" onClick={openCreate}>
            <MdAdd /> New Sale
          </button>
        )}
      </div>

      <DataTable
        columns={COLS}
        data={rows}
        loading={loading}
        searchable
        searchPlaceholder="Search sales…"
        actions={r => (
          <button className="btn-icon" title="View details" onClick={() => openView(r)}>
            <MdVisibility />
          </button>
        )}
      />

      {/* ── New Sale Modal ──────────────────────────────────── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Sale"
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving || !isValid}>
              {saving ? 'Processing…' : 'Process Sale'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Date + Method */}
          <div className="form-row">
            <FormField label="Sale Date" htmlFor="s-date" required>
              <input
                id="s-date"
                type="date"
                value={form.sale_date}
                onChange={e => setField('sale_date', e.target.value)}
              />
            </FormField>
            <FormField label="Payment Method" htmlFor="s-pm">
              <select id="s-pm" value={form.payment_method} onChange={e => setField('payment_method', e.target.value)}>
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </FormField>
          </div>

          {/* Items */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Items Sold
              </span>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }}
                onClick={addItem}
                type="button"
              >
                <MdAdd /> Add Row
              </button>
            </div>

            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead style={{ background: 'var(--color-bg-tertiary)' }}>
                  <tr>
                    {['Inventory Item', 'Description', 'Qty', 'Price (TZS)', 'Line Total', ''].map(h => (
                      <th key={h} style={{ padding: '0.55rem 0.6rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid var(--color-border)' }}>
                      {/* Inventory select */}
                      <td style={{ padding: '0.4rem 0.5rem', minWidth: 140 }}>
                        <select
                          value={it.inventory_item_id}
                          onChange={e => setItem(idx, 'inventory_item_id', e.target.value)}
                          style={{ width: '100%', minWidth: 130 }}
                        >
                          <option value="">— manual —</option>
                          {inventory.map(i => (
                            <option key={i.id} value={i.id}>
                              {i.item_name} ({parseFloat(i.quantity)} {i.unit})
                            </option>
                          ))}
                        </select>
                      </td>
                      {/* Description */}
                      <td style={{ padding: '0.4rem 0.5rem', minWidth: 140 }}>
                        <input
                          value={it.description}
                          onChange={e => setItem(idx, 'description', e.target.value)}
                          placeholder="Item description"
                          style={{ width: '100%', minWidth: 120 }}
                        />
                      </td>
                      {/* Qty */}
                      <td style={{ padding: '0.4rem 0.5rem', width: 70 }}>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={it.quantity}
                          onChange={e => setItem(idx, 'quantity', e.target.value)}
                          style={{ width: 65 }}
                        />
                      </td>
                      {/* Price */}
                      <td style={{ padding: '0.4rem 0.5rem', width: 110 }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={it.unit_price}
                          onChange={e => setItem(idx, 'unit_price', e.target.value)}
                          placeholder="0.00"
                          style={{ width: 100 }}
                        />
                      </td>
                      {/* Line total */}
                      <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600, color: 'var(--color-accent-green)', whiteSpace: 'nowrap' }}>
                        {formatCurrency((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0))}
                      </td>
                      {/* Remove */}
                      <td style={{ padding: '0.4rem 0.4rem', width: 36 }}>
                        {form.items.length > 1 && (
                          <button
                            className="btn-icon"
                            type="button"
                            style={{ color: 'var(--color-accent-red)' }}
                            onClick={() => removeItem(idx)}
                          >
                            <MdDelete />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <FormField label="Notes (optional)" htmlFor="s-notes">
            <textarea
              id="s-notes"
              rows={2}
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              placeholder="Any notes about this sale…"
            />
          </FormField>

          {/* Total */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.9rem 1.1rem',
            background: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--color-border)',
          }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              Total Amount
            </span>
            <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-accent-green)' }}>
              {formatCurrency(total)}
            </span>
          </div>

        </div>
      </Modal>

      {/* ── View Sale Modal ─────────────────────────────────── */}
      <Modal
        open={!!viewSale}
        onClose={() => { setViewSale(null); setViewItems([]); }}
        title={viewSale ? `Sale — ${viewSale.sale_number}` : ''}
        size="md"
        footer={<button className="btn btn-secondary" onClick={() => { setViewSale(null); setViewItems([]); }}>Close</button>}
      >
        {viewSale && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div className="form-row">
              <div><span style={{ color: 'var(--color-text-secondary)' }}>Date</span><br /><b>{formatDate(viewSale.sale_date)}</b></div>
              <div><span style={{ color: 'var(--color-text-secondary)' }}>Method</span><br /><span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{viewSale.payment_method}</span></div>
              <div><span style={{ color: 'var(--color-text-secondary)' }}>Recorded by</span><br /><b>{viewSale.created_by_name}</b></div>
            </div>

            {viewLoading ? (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-secondary)' }}>Loading…</div>
            ) : viewItems.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead style={{ background: 'var(--color-bg-tertiary)' }}>
                  <tr>
                    {['Item', 'Qty', 'Price', 'Total'].map(h => (
                      <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viewItems.map((it, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.45rem 0.6rem' }}>{it.description || it.item_name || '—'}</td>
                      <td style={{ padding: '0.45rem 0.6rem' }}>{parseFloat(it.quantity)} {it.unit || ''}</td>
                      <td style={{ padding: '0.45rem 0.6rem' }}>{formatCurrency(it.unit_price)}</td>
                      <td style={{ padding: '0.45rem 0.6rem', fontWeight: 600, color: 'var(--color-accent-green)' }}>{formatCurrency(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.75rem 1rem',
              background: 'var(--color-bg-tertiary)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--color-border)',
            }}>
              <span style={{ fontWeight: 600 }}>Total</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-accent-green)' }}>
                {formatCurrency(viewSale.total_amount)}
              </span>
            </div>

            {viewSale.notes && (
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.83rem' }}>
                <b>Notes:</b> {viewSale.notes}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
