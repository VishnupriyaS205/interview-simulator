import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const user = JSON.parse(localStorage.getItem("interviewUser"));
  const token = localStorage.getItem("authToken");

  if (!isAuthenticated || !user?.id || !token) {
    return <Navigate to="/signup" replace />;
  }

  return children;
}
