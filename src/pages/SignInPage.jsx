import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import aptivaMark from "../assets/aptiva-mark.png";
import PasswordField from "../components/PasswordField";

export default function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateForm = () => {
    const errors = {};

    if (!email.trim()) {
      errors.email = "Email is required.";
    } else if (!emailPattern.test(email)) {
      errors.email = "Enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      const response = await fetch("/api/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFieldErrors({
          [data.field || "password"]: data.error || "Password is incorrect.",
        });
        return;
      }

      localStorage.setItem("interviewUser", JSON.stringify(data.user));
      localStorage.removeItem("authToken");
      localStorage.removeItem("isAuthenticated");
      setFieldErrors({});
      setFormError("");
      navigate("/dashboard");
    } catch (err) {
      console.error("Signin Error:", err);
      setFormError("Signin failed. Check if the backend server is running.");
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand auth-brand" to="/">
          <span className="brand-mark">
            <img src={aptivaMark} alt="" />
          </span>
          <strong>Aptiva</strong>
        </Link>
        <p className="eyebrow">Welcome back</p>
        <h1>Sign in</h1>
        <p>Continue your practice plan and review your latest interviews.</p>

        <form className="form-card" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="text"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((current) => ({ ...current, email: "" }));
                setFormError("");
              }}
            />
            {fieldErrors.email && (
              <span className="field-error">{fieldErrors.email}</span>
            )}
          </label>
          <PasswordField
            label="Password"
            placeholder="Enter password"
            value={password}
            error={fieldErrors.password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((current) => ({ ...current, password: "" }));
              setFormError("");
            }}
          />
          {formError && <p className="error-text">{formError}</p>}
          <button className="primary-button" type="submit">
            Sign in
          </button>
        </form>

        <p className="auth-switch">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
