import { MdErrorOutline } from 'react-icons/md';
import '../../styles/FormField.css';

/**
 * Label + input + inline error message wrapper.
 * @prop {string}    label
 * @prop {string}    error       - Validation error message
 * @prop {string}    hint        - Optional helper text
 * @prop {boolean}   required
 * @prop {ReactNode} children    - The input/select/textarea element
 */
export default function FormField({ label, error, hint, required, children, htmlFor }) {
  return (
    <div className={`form-field${error ? ' form-field--error' : ''}`}>
      {label && (
        <label className="form-field-label" htmlFor={htmlFor}>
          {label}
          {required && <span className="form-field-required">*</span>}
        </label>
      )}
      {children}
      {error && (
        <span className="form-field-error">
          <MdErrorOutline size={13} /> {error}
        </span>
      )}
      {hint && !error && <span className="form-field-hint">{hint}</span>}
    </div>
  );
}
