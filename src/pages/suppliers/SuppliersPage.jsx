import { useState, useEffect, useCallback } from 'react';
import { MdAdd, MdEdit, MdDelete } from 'react-icons/md';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import FormField from '../../components/common/FormField';
import { formatCurrency } from '../../utils/formatCurrency';

function validate(f) {
  const e = {};
  if (!f.name?.trim()) e.name = 'Supplier name is required';
  return e;
}

const COLS = [
  { key: 'name',            label: 'Supplier' },
  { key: 'contact_person',  label: 'Contact',  render: v => v || '—' },
  { key: 'phone',           label: 'Phone',    render: v => v || '—' },
  { key: 'email',           label: 'Email',    render: v => v || '—' },
  { key: 'outstanding_balance', label: 'Outstanding',
    render: v => <span style={{ color: parseFloat(v) > 0 ? 'var(--color-accent-orange)' : 'var(--color-text-secondary)', fontWeight: 600 }}>{formatCurrency(v)}</span> },
];

export default function SuppliersPage() {
  const addToast = useUiStore(s => s.addToast);
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(false);
  const [edit, setEdit]         = useState(null);
  const [del, setDel]           = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving]     = useState(false);
  const blank = () => ({ name: '', contact_person: '', phone: '', email: '', address: '' });
  const [form, setFormState]    = useState(blank());
  const [errors, setErrors]     = useState({});
  const [touched, setTouched]   = useState({});

  const load = useCallback(async () => {
    try { const { data } = await api.get('/suppliers'); setRows(data.data); }
    catch { addToast({ type: 'error', message: 'Failed to load suppliers' }); }
    finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEdit(null); setFormState(blank()); setErrors({}); setTouched({}); setOpen(true); }
  function openEdit(r)  { setEdit(r); setFormState({ name: r.name, contact_person: r.contact_person||'', phone: r.phone||'', email: r.email||'', address: r.address||'' }); setErrors({}); setTouched({}); setOpen(true); }

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
      edit ? await api.put(`/suppliers/${edit.id}`, form) : await api.post('/suppliers', form);
      addToast({ type: 'success', message: edit ? 'Supplier updated' : 'Supplier created' });
      setOpen(false); load();
    } catch (err) { addToast({ type: 'error', message: err.response?.data?.error || 'Save failed' }); }
    finally { setSaving(false); }
  }

  async function doDelete() {
    setDeleting(true);
    try { await api.delete(`/suppliers/${del.id}`); addToast({ type: 'success', message: 'Deleted' }); setDel(null); load(); }
    catch (err) { addToast({ type: 'error', message: err.response?.data?.error || 'Delete failed' }); }
    finally { setDeleting(false); }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Suppliers</h2>
        <button className="btn btn-primary" onClick={openCreate}><MdAdd /> Add Supplier</button>
      </div>

      <DataTable columns={COLS} data={rows} loading={loading} searchable searchPlaceholder="Search suppliers…"
        actions={r => (<>
          <button className="btn-icon" title="Edit" onClick={() => openEdit(r)}><MdEdit /></button>
          <button className="btn-icon" title="Delete" style={{ color: 'var(--color-accent-red)' }} onClick={() => setDel(r)}><MdDelete /></button>
        </>)}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={edit ? 'Edit Supplier' : 'New Supplier'} size="md"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || Object.keys(validate(form)).length > 0}>{saving ? 'Saving…' : edit ? 'Save' : 'Create'}</button>
        </>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FormField label="Supplier Name" error={touched.name && errors.name} required htmlFor="sp-name">
            <input id="sp-name" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="ABC Paint Supplies" />
          </FormField>
          <div className="form-row">
            <FormField label="Contact Person" htmlFor="sp-cp"><input id="sp-cp" value={form.contact_person} onChange={e => setField('contact_person', e.target.value)} /></FormField>
            <FormField label="Phone" htmlFor="sp-ph"><input id="sp-ph" value={form.phone} onChange={e => setField('phone', e.target.value)} /></FormField>
          </div>
          <FormField label="Email" htmlFor="sp-em"><input id="sp-em" type="email" value={form.email} onChange={e => setField('email', e.target.value)} /></FormField>
          <FormField label="Address" htmlFor="sp-addr"><textarea id="sp-addr" rows={2} value={form.address} onChange={e => setField('address', e.target.value)} /></FormField>
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} onConfirm={doDelete} loading={deleting}
        title="Delete Supplier" message={`Delete "${del?.name}"? This cannot be undone.`} variant="danger" />
    </div>
  );
}
