import { useState, useEffect, useCallback } from 'react';
import { MdAdd, MdVisibility, MdSend } from 'react-icons/md';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import FormField from '../../components/common/FormField';
import { formatDate } from '../../utils/formatDate';
import { formatCurrency } from '../../utils/formatCurrency';
import '../../styles/AccountingPages.css';

export default function JournalEntries() {
  const addToast = useUiStore((s) => s.addToast);
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState(null);
  const [postConfirm, setPostConfirm] = useState(null);
  const [posting, setPosting] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const blankForm = () => ({
    entry_date: today, description: '',
    lines: [
      { account_id: '', debit: '', credit: '', description: '' },
      { account_id: '', debit: '', credit: '', description: '' },
    ]
  });
  const [form, setForm] = useState(blankForm());

  const load = useCallback(async () => {
    try {
      const [jeRes, acRes] = await Promise.all([api.get('/journal-entries'), api.get('/accounts')]);
      setEntries(jeRes.data.data);
      setAccounts(acRes.data.data);
    } catch { addToast({ type: 'error', message: 'Failed to load' }); }
    finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  function setLine(i, k, v) {
    setForm((f) => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [k]: v };
      return { ...f, lines };
    });
  }

  const totalDebit  = form.lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
  const totalCredit = form.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0;

  async function handleSave() {
    if (!balanced) { addToast({ type: 'error', message: 'Debits must equal credits' }); return; }
    setSaving(true);
    try {
      const lines = form.lines.filter((l) => l.account_id)
        .map((l) => ({ ...l, debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0 }));
      await api.post('/journal-entries', { entry_date: form.entry_date, description: form.description, lines });
      addToast({ type: 'success', message: 'Journal entry saved as draft' });
      setModalOpen(false); setForm(blankForm()); load();
    } catch (err) { addToast({ type: 'error', message: err.response?.data?.error || 'Save failed' }); }
    finally { setSaving(false); }
  }

  async function handlePost() {
    if (!postConfirm) return;
    setPosting(true);
    try {
      await api.post(`/journal-entries/${postConfirm.id}/post`);
      addToast({ type: 'success', message: `Entry ${postConfirm.reference_number} posted` });
      setPostConfirm(null); load();
    } catch (err) { addToast({ type: 'error', message: err.response?.data?.error || 'Post failed' }); }
    finally { setPosting(false); }
  }

  const COLUMNS = [
    { key: 'entry_date', label: 'Date', render: (v) => formatDate(v) },
    { key: 'reference_number', label: 'Reference' },
    { key: 'description', label: 'Description' },
    { key: 'created_by_name', label: 'Created By' },
    { key: 'source_type', label: 'Source', render: (v) => <span className="badge badge-neutral">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge badge-${v === 'posted' ? 'success' : 'warning'}`}>{v}</span> },
  ];

  return (
    <div className="accounting-page">
      <div className="page-header">
        <h2>Journal Entries</h2>
        <button className="btn btn-primary" onClick={() => { setForm(blankForm()); setModalOpen(true); }}><MdAdd /> New Entry</button>
      </div>

      <DataTable columns={COLUMNS} data={entries} loading={loading} searchable
        actions={(row) => (
          <>
            <button className="btn-icon" title="View" onClick={() => setViewEntry(row)}><MdVisibility /></button>
            {row.status === 'draft' && (
              <button className="btn-icon" title="Post" style={{ color: 'var(--color-accent-green)' }} onClick={() => setPostConfirm(row)}><MdSend /></button>
            )}
          </>
        )}
      />

      {/* Create Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Journal Entry" size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !balanced}>{saving ? 'Saving…' : 'Save Draft'}</button>
          </>
        }
      >
        <div className="user-form">
          <div className="form-row">
            <FormField label="Date" required htmlFor="je-date">
              <input id="je-date" type="date" value={form.entry_date} onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))} />
            </FormField>
            <FormField label="Description" htmlFor="je-desc">
              <input id="je-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Entry description" />
            </FormField>
          </div>
          <table className="je-lines-table">
            <thead><tr><th style={{ minWidth: 200 }}>Account</th><th>Debit</th><th>Credit</th><th>Note</th><th></th></tr></thead>
            <tbody>
              {form.lines.map((line, i) => (
                <tr key={i}>
                  <td>
                    <select value={line.account_id} onChange={(e) => setLine(i, 'account_id', e.target.value)}>
                      <option value="">— Select account —</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}
                    </select>
                  </td>
                  <td><input type="number" min="0" step="0.01" placeholder="0.00" value={line.debit} onChange={(e) => setLine(i, 'debit', e.target.value)} style={{ width: 100 }} /></td>
                  <td><input type="number" min="0" step="0.01" placeholder="0.00" value={line.credit} onChange={(e) => setLine(i, 'credit', e.target.value)} style={{ width: 100 }} /></td>
                  <td><input value={line.description} onChange={(e) => setLine(i, 'description', e.target.value)} placeholder="Optional" /></td>
                  <td>{form.lines.length > 2 && <button className="btn-icon" style={{ color: 'var(--color-accent-red)', fontSize: '1.1rem' }} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }))}>×</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-secondary" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }} onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, { account_id: '', debit: '', credit: '', description: '' }] }))}>+ Add Line</button>
          <div className="je-totals">
            <span>Debit: <strong>{formatCurrency(totalDebit)}</strong></span>
            <span>Credit: <strong>{formatCurrency(totalCredit)}</strong></span>
            {totalDebit > 0 && <span className={balanced ? 'je-balanced' : 'je-unbalanced'}>{balanced ? '✓ Balanced' : `Diff: ${formatCurrency(Math.abs(totalDebit - totalCredit))}`}</span>}
          </div>
        </div>
      </Modal>

      {/* View detail */}
      <Modal open={Boolean(viewEntry)} onClose={() => setViewEntry(null)} title={`Entry: ${viewEntry?.reference_number}`} size="md"
        footer={<button className="btn btn-secondary" onClick={() => setViewEntry(null)}>Close</button>}
      >
        {viewEntry && (
          <div style={{ fontSize: '0.875rem', display: 'grid', gap: '0.5rem' }}>
            <p><strong>Date:</strong> {formatDate(viewEntry.entry_date)}</p>
            <p><strong>Status:</strong> <span className={`badge badge-${viewEntry.status === 'posted' ? 'success' : 'warning'}`}>{viewEntry.status}</span></p>
            <p><strong>Source:</strong> {viewEntry.source_type}</p>
            <p><strong>Description:</strong> {viewEntry.description || '—'}</p>
            <p><strong>Created by:</strong> {viewEntry.created_by_name}</p>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={Boolean(postConfirm)} onClose={() => setPostConfirm(null)} onConfirm={handlePost} loading={posting}
        title="Post Journal Entry" variant="warning"
        message={`Post ${postConfirm?.reference_number}? Posted entries cannot be edited.`}
      />
    </div>
  );
}
