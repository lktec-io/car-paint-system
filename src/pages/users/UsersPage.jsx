import { useState, useEffect, useCallback } from 'react';
import { MdAdd, MdEdit, MdBlock, MdCheckCircle } from 'react-icons/md';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import FormField from '../../components/common/FormField';
import { formatDateTime } from '../../utils/formatDate';
import '../../styles/UsersPage.css';

const ROLES = ['super_admin', 'accountant', 'store_manager', 'sales_officer', 'technician', 'viewer'];

const COLUMNS = [
  { key: 'full_name', label: 'Name' },
  { key: 'email', label: 'Email' },
  {
    key: 'role',
    label: 'Role',
    render: (val) => (
      <span className={`role-badge role-${val}`}>{val?.replace(/_/g, ' ')}</span>
    ),
  },
  {
    key: 'is_active',
    label: 'Status',
    render: (val) => (
      <span className={`status-badge status-badge--${val ? 'active' : 'inactive'}`}>
        {val ? <MdCheckCircle /> : <MdBlock />}
        {val ? 'Active' : 'Inactive'}
      </span>
    ),
  },
  { key: 'last_login', label: 'Last Login', render: (val) => formatDateTime(val) },
];

function validate(form, isEdit) {
  const e = {};
  if (!form.full_name?.trim()) e.full_name = 'Full name is required';
  if (!form.email?.trim()) e.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
  if (!isEdit && !form.password) e.password = 'Password is required';
  if (form.password && form.password.length < 8) e.password = 'Min 8 characters';
  if (!form.role) e.role = 'Role is required';
  return e;
}

export default function UsersPage() {
  const addToast = useUiStore((s) => s.addToast);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'viewer' });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmUser, setConfirmUser] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data.data);
    } catch (err) {
      addToast({ type: 'error', message: err.response?.data?.error || 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  function openCreate() {
    setEditUser(null);
    setForm({ full_name: '', email: '', password: '', role: 'viewer' });
    setErrors({});
    setTouched({});
    setModalOpen(true);
  }

  function openEdit(user) {
    setEditUser(user);
    setForm({ full_name: user.full_name, email: user.email, password: '', role: user.role });
    setErrors({});
    setTouched({});
    setModalOpen(true);
  }

  function setField(key, value) {
    const next = { ...form, [key]: value };
    setForm(next);
    setTouched((t) => ({ ...t, [key]: true }));
    setErrors(validate(next, Boolean(editUser)));
  }

  function touchAll() {
    const allTouched = Object.fromEntries(Object.keys(form).map((k) => [k, true]));
    setTouched(allTouched);
    const errs = validate(form, Boolean(editUser));
    setErrors(errs);
    return errs;
  }

  async function handleSave() {
    if (Object.keys(touchAll()).length) return;
    setSaving(true);
    try {
      const payload = { full_name: form.full_name, email: form.email, role: form.role };
      if (form.password) payload.password = form.password;
      if (!editUser) payload.password = form.password;

      if (editUser) {
        await api.put(`/users/${editUser.id}`, payload);
        addToast({ type: 'success', message: 'User updated successfully' });
      } else {
        await api.post('/users', payload);
        addToast({ type: 'success', message: 'User created successfully' });
      }
      setModalOpen(false);
      loadUsers();
    } catch (err) {
      addToast({ type: 'error', message: err.response?.data?.error || 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    if (!confirmUser) return;
    setConfirming(true);
    try {
      await api.put(`/users/${confirmUser.id}`, { is_active: !confirmUser.is_active });
      addToast({ type: 'success', message: `User ${confirmUser.is_active ? 'deactivated' : 'activated'}` });
      setConfirmUser(null);
      loadUsers();
    } catch (err) {
      addToast({ type: 'error', message: err.response?.data?.error || 'Failed' });
    } finally {
      setConfirming(false);
    }
  }

  const isFormValid = Object.keys(validate(form, Boolean(editUser))).length === 0;

  return (
    <div className="users-page">
      <div className="page-header">
        <h2>User Management</h2>
        <button className="btn btn-primary" onClick={openCreate}>
          <MdAdd /> Add User
        </button>
      </div>

      <DataTable
        columns={COLUMNS}
        data={users}
        loading={loading}
        searchable
        searchPlaceholder="Search users…"
        emptyMessage="No users found"
        actions={(row) => (
          <>
            <button className="btn-icon" title="Edit" onClick={() => openEdit(row)}>
              <MdEdit />
            </button>
            <button
              className="btn-icon"
              title={row.is_active ? 'Deactivate' : 'Activate'}
              onClick={() => setConfirmUser(row)}
              style={{ color: row.is_active ? 'var(--color-accent-red)' : 'var(--color-accent-green)' }}
            >
              {row.is_active ? <MdBlock /> : <MdCheckCircle />}
            </button>
          </>
        )}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editUser ? 'Edit User' : 'Add User'}
        size="md"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !isFormValid}>
              {saving ? 'Saving…' : editUser ? 'Save Changes' : 'Create User'}
            </button>
          </>
        }
      >
        <div className="user-form">
          <div className="form-row">
            <FormField label="Full Name" error={touched.full_name && errors.full_name} required htmlFor="uf-name">
              <input id="uf-name" value={form.full_name} onChange={(e) => setField('full_name', e.target.value)} placeholder="Jane Smith" />
            </FormField>
            <FormField label="Email" error={touched.email && errors.email} required htmlFor="uf-email">
              <input id="uf-email" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="jane@example.com" />
            </FormField>
          </div>
          <div className="form-row">
            <FormField label={editUser ? 'New Password (leave blank to keep)' : 'Password'} error={touched.password && errors.password} required={!editUser} htmlFor="uf-pass">
              <input id="uf-pass" type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} placeholder="Min 8 characters" autoComplete="new-password" />
            </FormField>
            <FormField label="Role" error={touched.role && errors.role} required htmlFor="uf-role">
              <select id="uf-role" value={form.role} onChange={(e) => setField('role', e.target.value)}>
                {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
            </FormField>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmUser)}
        onClose={() => setConfirmUser(null)}
        onConfirm={handleToggle}
        loading={confirming}
        title={confirmUser?.is_active ? 'Deactivate User' : 'Activate User'}
        message={`Are you sure you want to ${confirmUser?.is_active ? 'deactivate' : 'activate'} ${confirmUser?.full_name}?`}
        variant={confirmUser?.is_active ? 'danger' : 'warning'}
      />
    </div>
  );
}
