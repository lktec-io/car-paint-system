import { useState, useEffect, useCallback } from 'react';
import { MdAdd, MdEdit } from 'react-icons/md';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import { formatCurrency } from '../../utils/formatCurrency';

function validate(f) {
  const e = {};
  if (!f.name?.trim()) e.name = 'Customer name is required';
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Invalid email';
  return e;
}

const COLS = [
  { key: 'name',  label: 'Customer' },
  { key: 'phone', label: 'Phone', render: v => v || '—' },
  { key: 'email', label: 'Email', render: v => v || '—' },
  { key: 'outstanding_balance', label: 'Outstanding',
    render: v => <span style={{ color: parseFloat(v) > 0 ? 'var(--color-accent-orange)' : 'var(--color-text-secondary)', fontWeight: 600 }}>{formatCurrency(v)}</span> },
  { key: 'total_spent', label: 'Total Spent',
    render: v => <span style={{ fontWeight: 600 }}>{formatCurrency(v)}</span> },
];

const blank = () => ({ name: '', phone: '', email: '', address: '' });

export default function CustomersPage() {
  const addToast = useUiStore(s => s.addToast);
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(false);
  const [edit, setEdit]         = useState(null);
  const [saving, setSaving]     = useState(false);
  const [form, setFormState]    = useState(blank());
  const [errors, setErrors]     = useState({});
  const [touched, setTouched]   = useState({});

  const load = useCallback(async () => {
    try { const { data } = await api.get('/customers'); setRows(data.data); }
    catch { addToast({ type: 'error', message: 'Failed to load customers' }); }
    finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEdit(null); setFormState(blank()); setErrors({}); setTouched({}); setOpen(true); }
  function openEdit(r)  { setEdit(r); setFormState({ name: r.name, phone: r.phone||'', email: r.email||'', address: r.address||'' }); setErrors({}); setTouched({}); setOpen(true); }

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
      edit ? await api.put(`/customers/${edit.id}`, form) : await api.post('/customers', form);
      addToast({ type: 'success', message: edit ? 'Customer updated' : 'Customer created' });
      setOpen(false); load();
    } catch (err) { addToast({ type: 'error', message: err.response?.data?.error || 'Save failed' }); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Customers</h2>
        <button className="btn btn-primary" onClick={openCreate}><MdAdd /> Add Customer</button>
      </div>

      <DataTable columns={COLS} data={rows} loading={loading} searchable searchPlaceholder="Search customers…"
        actions={r => (
          <button className="btn-icon" title="Edit" onClick={() => openEdit(r)}><MdEdit /></button>
        )}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={edit ? 'Edit Customer' : 'New Customer'} size="md"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || Object.keys(validate(form)).length > 0}>{saving ? 'Saving…' : edit ? 'Save' : 'Create'}</button>
        </>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FormField label="Customer Name" error={touched.name && errors.name} required htmlFor="cu-name">
            <input id="cu-name" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="John Doe" />
          </FormField>
          <div className="form-row">
            <FormField label="Phone" htmlFor="cu-ph"><input id="cu-ph" value={form.phone} onChange={e => setField('phone', e.target.value)} /></FormField>
            <FormField label="Email" error={touched.email && errors.email} htmlFor="cu-em"><input id="cu-em" type="email" value={form.email} onChange={e => setField('email', e.target.value)} /></FormField>
          </div>
          <FormField label="Address" htmlFor="cu-addr"><textarea id="cu-addr" rows={2} value={form.address} onChange={e => setField('address', e.target.value)} /></FormField>
        </div>
      </Modal>
    </div>
  );
}
