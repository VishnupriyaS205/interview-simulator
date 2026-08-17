import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import PasswordField from "../components/PasswordField";

const levels = ["Beginner", "Intermediate", "Advanced"];

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function SettingsPage() {
  const user = JSON.parse(localStorage.getItem("interviewUser"));
  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    email: user?.email || "",
    careerGoal: user?.careerGoal || "",
    level: user?.level || "Beginner",
    profilePicture: user?.profilePicture || "",
    password: "",
    confirmPassword: "",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) {
        return;
      }

      try {
        const response = await fetch(`/api/users/${user.id}/profile`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Profile query failed");
        }

        setForm((current) => ({
          ...current,
          fullName: data.user.fullName,
          email: data.user.email,
          careerGoal: data.user.careerGoal,
          level: data.user.level,
          profilePicture: data.user.profilePicture,
        }));
        localStorage.setItem("interviewUser", JSON.stringify(data.user));
      } catch (err) {
        console.error("Profile Fetch Error:", err);
        setError("Could not load your profile.");
      }
    };

    fetchProfile();
  }, [user?.id]);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setStatus("");
    setError("");
    if (field === "password") {
      setPasswordError("");
    }
    if (field === "confirmPassword") {
      setConfirmPasswordError("");
    }
  };

  const saveProfile = async (overrides = {}) => {
    const nextForm = {
      ...form,
      ...overrides,
    };

    const response = await fetch(`/api/users/${user.id}/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: nextForm.fullName.trim(),
        email: nextForm.email.trim(),
        careerGoal: nextForm.careerGoal.trim(),
        level: nextForm.level,
        profilePicture: nextForm.profilePicture.trim(),
        password: nextForm.password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const profileError = new Error(data.error || "Profile update failed");
      profileError.field = data.field;
      throw profileError;
    }

    localStorage.setItem("interviewUser", JSON.stringify(data.user));
    setForm((current) => ({
      ...current,
      ...data.user,
      fullName: data.user.fullName,
      password: "",
      confirmPassword: "",
    }));
    return data.user;
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for your profile picture.");
      return;
    }

    const reader = new FileReader();

    reader.onload = async () => {
      const profilePicture = reader.result;
      updateField("profilePicture", profilePicture);

      try {
        setLoading(true);
        await saveProfile({ profilePicture });
        setStatus("Profile picture saved to your account.");
      } catch (err) {
        console.error("Profile Picture Save Error:", err);
        setError(err.message || "Could not save the selected image.");
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError("Could not read the selected image.");
    };

    reader.readAsDataURL(file);
  };

  const validateForm = () => {
    if (!form.fullName.trim()) {
      return "Name is required.";
    }

    if (!form.email.trim()) {
      return "Email is required.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return "Enter a valid email address.";
    }

    if (!levels.includes(form.level)) {
      return "Choose a valid level.";
    }

    if (showPasswordReset && !form.password) {
      setPasswordError("New password is required.");
      return "password-field";
    }

    if (form.password && form.password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return "password-field";
    }

    if (showPasswordReset && !form.confirmPassword) {
      setConfirmPasswordError("Confirm password is required.");
      return "password-field";
    }

    if (showPasswordReset && form.password !== form.confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
      return "password-field";
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationMessage = validateForm();

    if (validationMessage) {
      if (validationMessage !== "password-field") {
        setError(validationMessage);
      }
      return;
    }

    try {
      setLoading(true);
      await saveProfile();
      setForm((current) => ({
        ...current,
        password: "",
        confirmPassword: "",
      }));
      setShowPasswordReset(false);
      setError("");
      setStatus(
        form.password
          ? "Password updated successfully."
          : "Profile saved to your account.",
      );
    } catch (err) {
      console.error("Profile Update Error:", err);
      if (err.field === "password") {
        setPasswordError(err.message);
      } else {
        setError(
          err.message || "Could not update profile. Check if the backend is running.",
        );
      }
    } finally {
      setLoading(false);
    }
  };
  const isPasswordStatus = status === "Password updated successfully.";

  return (
    <>
      <PageHeader
       
        title="Profile settings"
        description="Update only your authenticated account details and interview preferences."
      />

      <form className="settings-profile" onSubmit={handleSubmit}>
        <section className="profile-summary card">
          <div className="avatar-preview">
            {form.profilePicture ? (
              <img src={form.profilePicture} alt={form.fullName || "Profile"} />
            ) : (
              <span>{getInitials(form.fullName || "User")}</span>
            )}
          </div>
          <div>
            <p className="eyebrow">Authenticated user</p>
            <h2>{form.fullName || "Your profile"}</h2>
            <p className="muted">{form.email}</p>
          </div>
        </section>

        <section className="settings-grid">
          <article className="card form-panel">
            <div className="card-header">
              <div>
                <p className="eyebrow">Account</p>
                <h2>Personal details</h2>
              </div>
            </div>

            <label>
              Display name
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
              />
            </label>

            <label>
              Profile picture
              <div className="file-upload">
                <br></br>
                <label htmlFor="profile-picture" className="file-button">
                  Choose File
                </label>

                <input
                  id="profile-picture"
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                />

                <span className="file-name">
                  {form.profilePicture ? "Image selected" : "No file chosen"}
                </span>
              </div>
              {status && !isPasswordStatus && (
                <p className="status-text">{status}</p>
              )}
            </label>
            <br></br>
            <div className="profile-actions">
              {form.profilePicture && (
                <button
                  className="primary-button"
                  type="button"
                  onClick={async () => {
                    updateField("profilePicture", "");

                    try {
                      setLoading(true);
                      await saveProfile({ profilePicture: "" });
                      setStatus("Profile picture removed from your account.");
                    } catch (err) {
                      console.error("Profile Picture Remove Error:", err);
                      setError(
                        err.message || "Could not remove profile picture.",
                      );
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Remove profile picture
                </button>
              )}
              <button
                type="button"
                className="reset-password-button"
                onClick={() => {
                  setShowPasswordReset(true);
                  setError("");
                  setStatus("");
                  setForm((current) => ({
                    ...current,
                    password: "",
                    confirmPassword: "",
                  }));
                  setPasswordError("");
                  setConfirmPasswordError("");
                }}
              >
                Reset Password
              </button>
            </div>
            {isPasswordStatus && <p className="status-text">{status}</p>}
            {showPasswordReset && (
              <div className="password-reset-fields">
                <PasswordField
                  autoComplete="new-password"
                  className="blue-field"
                  label="New Password"
                  placeholder="Enter new password"
                  value={form.password}
                  error={passwordError}
                  onChange={(e) => updateField("password", e.target.value)}
                />

                {showPasswordReset && (
                  <PasswordField
                    autoComplete="new-password"
                    className="blue-field"
                    label="Confirm New Password"
                    placeholder="Repeat new password"
                    value={form.confirmPassword}
                    error={confirmPasswordError}
                    onChange={(e) =>
                      updateField("confirmPassword", e.target.value)
                    }
                  />
                )}

                {form.password &&
                  form.confirmPassword &&
                  form.password === form.confirmPassword && (
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={loading}
                    >
                      {loading ? "Saving..." : "Save Password"}
                    </button>
                  )}

                <button
                  type="button"
                  className="cancel-reset-button"
                  onClick={() => {
                    setShowPasswordReset(false);
                    setForm((current) => ({
                      ...current,
                      password: "",
                      confirmPassword: "",
                    }));
                    setPasswordError("");
                    setConfirmPasswordError("");
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </article>

          <article className="card form-panel">
            <div className="card-header">
              <div>
                <p className="eyebrow">Interview plan</p>
                <h2>Practice level</h2>
              </div>
            </div>

            <label>
              Career goal
              <input
                type="text"
                placeholder="Example: Frontend Developer"
                value={form.careerGoal}
                onChange={(e) => updateField("careerGoal", e.target.value)}
              />
            </label>

            <label>
              Current level
              <select
                value={form.level}
                onChange={(e) => updateField("level", e.target.value)}
              >
                {levels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>

            {error && <p className="error-text">{error}</p>}

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save profile"}
            </button>
          </article>
        </section>
      </form>
    </>
  );
}
