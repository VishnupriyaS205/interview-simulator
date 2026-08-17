import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const [authStatus, setAuthStatus] = useState("checking");

  useEffect(() => {
    const verifySession = async () => {
      try {
        const response = await fetch("/api/me");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Authentication required");
        }

        localStorage.setItem("interviewUser", JSON.stringify(data.user));
        localStorage.removeItem("authToken");
        localStorage.removeItem("isAuthenticated");
        setAuthStatus("signed-in");
      } catch (err) {
        console.error("Session Check Error:", err);
        localStorage.removeItem("interviewUser");
        localStorage.removeItem("authToken");
        localStorage.removeItem("isAuthenticated");
        setAuthStatus("signed-out");
      }
    };

    verifySession();
  }, []);

  if (authStatus === "checking") {
    return (
      <main className="content">
        <section className="card">
          <p className="status-text">Checking your session...</p>
        </section>
      </main>
    );
  }

  if (authStatus === "signed-out") {
    return <Navigate to="/signin" replace />;
  }

  return children;
}
