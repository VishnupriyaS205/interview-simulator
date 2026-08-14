import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>The page you are looking for does not exist.</p>
        <Link className="primary-button" to="/">
          Return home
        </Link>
      </section>
    </main>
  );
}
