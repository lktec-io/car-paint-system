import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdVisibility, MdVisibilityOff, MdErrorOutline } from 'react-icons/md';
import api from '../../api/axios';
import useAuthStore from '../../stores/authStore';
import useUiStore from '../../stores/uiStore';
import '../../styles/login.css';

function validate(email, password) {
  const errors = {};
  if (!email) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address';
  }
  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }
  return errors;
}

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const addToast = useUiStore((s) => s.addToast);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  const errors = validate(email, password);
  const isValid = Object.keys(errors).length === 0;

  function handleBlur(field) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ email: true, password: true });

    if (!isValid) return;

    setLoading(true);
    setSubmitError('');

    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.data.user, data.data.accessToken);
      addToast({ type: 'success', message: `Welcome back, ${data.data.user.full_name}!` });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const message =
        err.response?.data?.error || 'Login failed. Please try again.';
      setSubmitError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo.svg" alt="Silas Paint Store" className="login-logo" />
          <h1>Silas Paint Store</h1>
          <p>Car Paint Shop Management System</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {submitError && (
            <div className="login-error-banner">
              <MdErrorOutline size={16} />
              {submitError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-wrapper">
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                placeholder="admin@carpaint.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setSubmitError(''); }}
                onBlur={() => handleBlur('email')}
                className={touched.email && errors.email ? 'input-error' : ''}
                disabled={loading}
              />
            </div>
            {touched.email && errors.email && (
              <span className="field-error">
                <MdErrorOutline size={13} /> {errors.email}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setSubmitError(''); }}
                onBlur={() => handleBlur('password')}
                className={touched.password && errors.password ? 'input-error' : ''}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((s) => !s)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
              </button>
            </div>
            {touched.password && errors.password && (
              <span className="field-error">
                <MdErrorOutline size={13} /> {errors.password}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="login-spinner" />
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="login-footer">
          <span>Silas Paint Store &copy; {new Date().getFullYear()} — All rights reserved</span>
        </div>
      </div>
    </div>
  );
}
