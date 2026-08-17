import { useState } from "react";

export default function PasswordField({
  autoComplete,
  className = "",
  error = "",
  id,
  label,
  onChange,
  placeholder,
  value,
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <label>
      {label}
      <span className="password-field">
        <input
          id={id}
          autoComplete={autoComplete}
          className={className}
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
        <button
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="password-toggle"
          type="button"
          onClick={() => setShowPassword((current) => !current)}
        >
          {showPassword ? (
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M3 3l18 18" />
              <path d="M10.7 5.1A10.8 10.8 0 0 1 12 5c5 0 8.8 4.3 10 7a14.7 14.7 0 0 1-3 4.3" />
              <path d="M6.5 6.5A14.3 14.3 0 0 0 2 12c1.2 2.7 5 7 10 7 1.8 0 3.4-.5 4.8-1.2" />
              <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
            </svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </span>
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
