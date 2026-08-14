import { Link } from "react-router-dom";
import aptivaImage from "../assets/aptiva.png";
import demoImage from "../assets/demo.png";

export default function LandingPage() {
  return (
    <main className="marketing-page">
      <nav className="public-nav">
        <Link className="brand" to="/">
          <span className="brand-mark">A</span>
          <span>
            <strong>Aptiva</strong>
            <small>Interview practice</small>
          </span>
        </Link>
        <div>
          <Link className="ghost-button" to="/signin">
            Sign in
          </Link>
          <Link className="primary-button small" to="/signup">
            Sign up
          </Link>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Prepare. Practice. Perform.</p>
          <img className="hero-logo" src={aptivaImage} alt="Aptiva" />
          <h3>Interview practice built for confident placement preparation.</h3>
          <p>
            Take role-based aptitude, English communication, and technical rounds
            with timed questions, score explanations, and a final report.
          </p>
          <div className="button-row">
            <Link className="primary-button" to="/signup">
              Create account
            </Link>
            <Link className="secondary-button" to="/signup">
              Start practice
            </Link>
          </div>
        </div>
        <div className="hero-demo">
          <img src={demoImage} alt="Aptiva practice dashboard preview" />
        </div>
      </section>

      <section className="landing-strip" aria-label="Platform highlights">
        <article>
          <strong>Role based</strong>
          <span>Choose your target role and matching skill.</span>
        </article>
        <article>
          <strong>Timed rounds</strong>
          <span>Practice with 16-minute interview sections.</span>
        </article>
        <article>
          <strong>Clear review</strong>
          <span>See scores, explanations, and final performance.</span>
        </article>
      </section>
    </main>
  );
}
