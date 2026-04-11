import { useState, useEffect, useCallback } from 'react';
import { MdAdd, MdEdit } from 'react-icons/md';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';

function validate(f) {
  const e = {};
  if (!f.expense_category_id) e.expense_category_id = 'Category required';
  if (!f.amount || parseFloat(f.amount) <= 0) e.amount = 'Enter a valid amount';
  if (!f.expense_date) e.expense_date = 'Date required';
  return e;
}

const COLS = [
  { key: 'expense_date',   label: 'Date',     render: v => formatDate(v) },
  { key: 'category_name',  label: 'Category' },
  { key: 'description',    label: 'Description', render: v => v || '—' },
  { key: 'payment_method', label: 'Method',   render: v => <span className="badge badge-neutral">{v}</span> },
  { key: 'amount', label: 'Amount',
    render: v => <span style={{ fontWeight: 600, color: 'var(--color-accent-red)' }}>{formatCurrency(v)}</span> },
  { key: 'created_by_name', label: 'By', render: v => v || '—' },
];

export default function ExpensesPage() {
  const addToast = useUiStore(s => s.addToast);
  const [rows, setRows]             = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [open, setOpen]             = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [catOpen, setCatOpen]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [catName, setCatName]       = useState('');

  const today = new Date().toISOString().split('T')[0];
  const blank = () => ({ expense_category_id: '', amount: '', expense_date: today, description: '', payment_method: 'cash' });
  const [form, setFormState]  = useState(blank());
  const [errors, setErrors]   = useState({});
  const [touched, setTouched] = useState({});

  const load = useCallback(async () => {
    try {
      const [exp, cat] = await Promise.all([api.get('/expenses'), api.get('/expenses/categories')]);
      setRows(exp.data.data);
      setCategories(cat.data.data);
    } catch { addToast({ type: 'error', message: 'Failed to load expenses' }); }
    finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditExpense(null); setFormState(blank()); setErrors({}); setTouched({}); setOpen(true); }
  function openEdit(r) { setEditExpense(r); setFormState({ expense_category_id: r.expense_category_id, amount: String(r.amount), expense_date: r.expense_date?.split('T')[0] || r.expense_date, description: r.description || '', payment_method: r.payment_method }); setErrors({}); setTouched({}); setOpen(true); }

  function setField(k, v) {
    const next = { ...form, [k]: v };
    setFormState(next); setTouched(t => ({ ...t, [k]: true })); setErrors(validate(next));
  }

  async function save() {
    setTouched(Object.fromEntries(Object.keys(form).map(k => [k, true])));
    const errs = validate(form); setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      if (editExpense) {
        await api.put(`/expenses/${editExpense.id}`, { ...form, amount: parseFloat(form.amount) });
        addToast({ type: 'success', message: 'Expense updated' });
      } else {
        await api.post('/expenses', { ...form, amount: parseFloat(form.amount) });
        addToast({ type: 'success', message: 'Expense recorded' });
      }
      setOpen(false); load();
    } catch (err) { addToast({ type: 'error', message: err.response?.data?.error || 'Save failed' }); }
    finally { setSaving(false); }
  }

  async function saveCategory() {
    if (!catName.trim()) return;
    setSaving(true);
    try {
      await api.post('/expenses/categories', { name: catName.trim() });
      addToast({ type: 'success', message: 'Category added' });
      setCatOpen(false); setCatName(''); load();
    } catch (err) { addToast({ type: 'error', message: err.response?.data?.error || 'Failed' }); }
    finally { setSaving(false); }
  }

  const totalMonth = rows
    .filter(r => r.expense_date?.startsWith(today.slice(0, 7)))
    .reduce((s, r) => s + parseFloat(r.amount || 0), 0);

  return (
    <div className="page-enter">
      <div className="page-header">
        <h2>Expenses <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 400, marginLeft: '0.5rem' }}>This month: {formatCurrency(totalMonth)}</span></h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setCatOpen(true)}>+ Category</button>
          <button className="btn btn-primary" onClick={openCreate}><MdAdd /> Add Expense</button>
        </div>
      </div>

      <DataTable columns={COLS} data={rows} loading={loading} searchable searchPlaceholder="Search expenses…"
        actions={r => (
          <button className="btn-icon" title="Edit" onClick={() => openEdit(r)}><MdEdit /></button>
        )}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={editExpense ? 'Edit Expense' : 'Record Expense'} size="md"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || Object.keys(validate(form)).length > 0}>{saving ? 'Saving…' : editExpense ? 'Save' : 'Record'}</button>
        </>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-row">
            <FormField label="Category" error={touched.expense_category_id && errors.expense_category_id} required htmlFor="exp-cat">
              <select id="exp-cat" value={form.expense_category_id} onChange={e => setField('expense_category_id', e.target.value)}>
                <option value="">Select category…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Payment Method" htmlFor="exp-pm">
              <select id="exp-pm" value={form.payment_method} onChange={e => setField('payment_method', e.target.value)}>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="mobile">Mobile Money</option>
              </select>
            </FormField>
          </div>
          <div className="form-row">
            <FormField label="Amount" error={touched.amount && errors.amount} required htmlFor="exp-amt">
              <input id="exp-amt" type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setField('amount', e.target.value)} />
            </FormField>
            <FormField label="Date" error={touched.expense_date && errors.expense_date} required htmlFor="exp-date">
              <input id="exp-date" type="date" value={form.expense_date} onChange={e => setField('expense_date', e.target.value)} />
            </FormField>
          </div>
          <FormField label="Description" htmlFor="exp-desc">
            <textarea id="exp-desc" rows={2} value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Optional details…" />
          </FormField>
        </div>
      </Modal>

      <Modal open={catOpen} onClose={() => setCatOpen(false)} title="New Expense Category" size="sm"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setCatOpen(false)} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={saveCategory} disabled={saving || !catName.trim()}>{saving ? 'Saving…' : 'Add'}</button>
        </>}
      >
        <FormField label="Category Name" required htmlFor="cat-name">
          <input id="cat-name" value={catName} onChange={e => setCatName(e.target.value)} placeholder="e.g. Utilities" autoFocus />
        </FormField>
      </Modal>
    </div>
  );
}
