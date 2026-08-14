import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PasswordField from "../components/PasswordField";

export default function SignUpPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const updateError = (field) => {
    setFieldErrors((current) => ({ ...current, [field]: "" }));
    setFormError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!fullName.trim()) {
      errors.fullName = "Full name is required.";
    }

    if (!email.trim()) {
      errors.email = "Email is required.";
    } else if (!emailPattern.test(email)) {
      errors.email = "Enter a valid email address.";
    }

    if (!password.trim()) {
      errors.password = "Password is required.";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFieldErrors({
          [data.field || "email"]: data.error || "Signup failed.",
        });
        return;
      }

      localStorage.setItem("interviewUser", JSON.stringify(data.user));
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("isAuthenticated", "true");
      setFieldErrors({});
      setFormError("");
      navigate("/dashboard");
    } catch (err) {
      console.error("Signup Error:", err);
      setFormError("Signup failed. Check if the backend server is running.");
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand auth-brand" to="/">
          <span className="brand-mark">A</span>
          <strong>Aptiva</strong>
        </Link>
        <p className="eyebrow">Create account</p>
        <h1>Sign up</h1>
        <p>Set up your interview practice profile.</p>

        <form className="form-card" onSubmit={handleSubmit} noValidate>
          <label>
            Full name
            <input
              type="text"
              placeholder="Your name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                updateError("fullName");
              }}
            />
            {fieldErrors.fullName && (
              <span className="field-error">{fieldErrors.fullName}</span>
            )}
          </label>
          <label>
            Email
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                updateError("email");
              }}
            />
            {fieldErrors.email && (
              <span className="field-error">{fieldErrors.email}</span>
            )}
          </label>
          <PasswordField
            label="Password"
            placeholder="Create password"
            value={password}
            error={fieldErrors.password}
            onChange={(e) => {
              setPassword(e.target.value);
              updateError("password");
            }}
          />
          {formError && <p className="error-text">{formError}</p>}
          <button className="primary-button" type="submit">
            Create account
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/signin">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
