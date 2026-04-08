import { useState, useEffect, useCallback } from 'react';
import { MdAdd, MdEdit } from 'react-icons/md';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import '../../styles/AccountingPages.css';

const TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'];

function validate(form) {
  const e = {};
  if (!form.account_code?.trim()) e.account_code = 'Code required';
  if (!form.account_name?.trim()) e.account_name = 'Name required';
  return e;
}

export default function ChartOfAccounts() {
  const addToast = useUiStore((s) => s.addToast);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editAcc, setEditAcc] = useState(null);
  const [form, setForm] = useState({ account_code: '', account_name: '', account_type: 'asset', parent_id: '' });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/accounts');
      setAccounts(data.data);
    } catch { addToast({ type: 'error', message: 'Failed to load accounts' }); }
    finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditAcc(null);
    setForm({ account_code: '', account_name: '', account_type: 'asset', parent_id: '' });
    setErrors({}); setTouched({}); setModalOpen(true);
  }

  function openEdit(acc) {
    setEditAcc(acc);
    setForm({ account_code: acc.account_code, account_name: acc.account_name, account_type: acc.account_type, parent_id: acc.parent_id || '' });
    setErrors({}); setTouched({}); setModalOpen(true);
  }

  function setField(k, v) {
    const next = { ...form, [k]: v };
    setForm(next); setTouched((t) => ({ ...t, [k]: true })); setErrors(validate(next));
  }

  async function handleSave() {
    setTouched(Object.fromEntries(Object.keys(form).map((k) => [k, true])));
    const errs = validate(form); setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const payload = { ...form, parent_id: form.parent_id || null };
      if (editAcc) {
        await api.put(`/accounts/${editAcc.id}`, payload);
        addToast({ type: 'success', message: 'Account updated' });
      } else {
        await api.post('/accounts', payload);
        addToast({ type: 'success', message: 'Account created' });
      }
      setModalOpen(false); load();
    } catch (err) { addToast({ type: 'error', message: err.response?.data?.error || 'Save failed' }); }
    finally { setSaving(false); }
  }

  if (loading) return <LoadingSpinner />;

  const grouped = {};
  TYPES.forEach((t) => { grouped[t] = []; });
  accounts.forEach((a) => { if (grouped[a.account_type]) grouped[a.account_type].push(a); });
  const isFormValid = Object.keys(validate(form)).length === 0;
  const parentOptions = accounts.filter((a) => a.account_type === form.account_type && !a.parent_id);

  return (
    <div className="accounting-page">
      <div className="page-header">
        <h2>Chart of Accounts</h2>
        <button className="btn btn-primary" onClick={openCreate}><MdAdd /> Add Account</button>
      </div>

      {TYPES.map((type) => (
        <div key={type} className="account-type-section">
          <div className="account-type-header">
            <h3>{type.charAt(0).toUpperCase() + type.slice(1)}</h3>
            <span className="text-muted" style={{ fontSize: '0.8rem' }}>({grouped[type].length})</span>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%' }}>
              <thead><tr><th>Code</th><th>Name</th><th>Parent</th><th>Status</th><th style={{ width: 60 }}></th></tr></thead>
              <tbody>
                {grouped[type].length === 0
                  ? <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '1rem' }}>No accounts</td></tr>
                  : grouped[type].map((acc) => (
                    <tr key={acc.id} className={acc.parent_id ? 'account-row--child' : ''}>
                      <td><code style={{ fontSize: '0.8rem', color: 'var(--color-accent-blue)' }}>{acc.account_code}</code></td>
                      <td>{acc.account_name}</td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>{acc.parent_name || '—'}</td>
                      <td><span className={`badge badge-${acc.is_active ? 'success' : 'neutral'}`}>{acc.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td><button className="btn-icon" onClick={() => openEdit(acc)}><MdEdit /></button></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editAcc ? 'Edit Account' : 'New Account'} size="md"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !isFormValid}>{saving ? 'Saving…' : editAcc ? 'Save' : 'Create'}</button>
          </>
        }
      >
        <div className="user-form">
          <div className="form-row">
            <FormField label="Code" error={touched.account_code && errors.account_code} required htmlFor="ac-code">
              <input id="ac-code" value={form.account_code} onChange={(e) => setField('account_code', e.target.value)} placeholder="1010" disabled={Boolean(editAcc)} />
            </FormField>
            <FormField label="Type" required htmlFor="ac-type">
              <select id="ac-type" value={form.account_type} onChange={(e) => setField('account_type', e.target.value)}>
                {TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Account Name" error={touched.account_name && errors.account_name} required htmlFor="ac-name">
            <input id="ac-name" value={form.account_name} onChange={(e) => setField('account_name', e.target.value)} placeholder="Cash on Hand" />
          </FormField>
          <FormField label="Parent Account (optional)" htmlFor="ac-parent">
            <select id="ac-parent" value={form.parent_id} onChange={(e) => setField('parent_id', e.target.value)}>
              <option value="">— None (top-level) —</option>
              {parentOptions.map((a) => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}
            </select>
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
