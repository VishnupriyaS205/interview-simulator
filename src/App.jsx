import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AnalysisPage from "./pages/AnalysisPage";
import DashboardPage from "./pages/DashboardPage";
import HistoryPage from "./pages/HistoryPage";
import LandingPage from "./pages/LandingPage";
import NotFoundPage from "./pages/NotFoundPage";
import PracticePage from "./pages/PracticePage";
import PracticeSessionPage from "./pages/PracticeSessionPage";
import ProgressPage from "./pages/ProgressPage";
import SettingsPage from "./pages/SettingsPage";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";

function ProtectedPage({ children }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedPage>
              <DashboardPage />
            </ProtectedPage>
          }
        />
        <Route
          path="/practice"
          element={
            <ProtectedPage>
              <PracticePage />
            </ProtectedPage>
          }
        />
        <Route
          path="/practice/session"
          element={
            <ProtectedPage>
              <PracticeSessionPage />
            </ProtectedPage>
          }
        />
        <Route
          path="/analysis/:id"
          element={
            <ProtectedPage>
              <AnalysisPage />
            </ProtectedPage>
          }
        />
        <Route
          path="/analysis"
          element={
            <ProtectedPage>
              <AnalysisPage />
            </ProtectedPage>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedPage>
              <HistoryPage />
            </ProtectedPage>
          }
        />
        <Route
          path="/progress"
          element={
            <ProtectedPage>
              <ProgressPage />
            </ProtectedPage>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedPage>
              <SettingsPage />
            </ProtectedPage>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}
