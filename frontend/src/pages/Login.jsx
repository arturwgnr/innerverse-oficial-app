import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { GoogleIcon } from "../components/GoogleIcon.jsx";
import { signIn, signUp } from "../lib/authClient.js";

export function Login() {
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  // Landing's two CTAs ("Get started" vs "Log in") land here with a
  // distinct ?mode= so they don't feel like the same button twice
  // (UPDATES.md #1).
  const [mode, setMode] = useState(searchParams.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result =
        mode === "signin"
          ? await signIn.email({ email, password })
          : await signUp.email({ email, password, name: name || email.split("@")[0] });

      if (result.error) {
        showToast(result.error.message || t.common.genericError, "error");
      } else {
        // Read by Today.jsx right after this reload to fire an Oracle-voiced
        // greeting (UPDATES.md round 4 #2). Only a sign-in, not a sign-up,
        // greets, a brand-new account goes straight to onboarding instead.
        if (mode === "signin") {
          try {
            window.localStorage.setItem("innerverse.justSignedIn", "1");
          } catch {
            // Greeting is a nice-to-have, sign-in itself already succeeded.
          }
        }
        // Full reload instead of a client-side navigate: useSession()'s cache
        // can lag a tick behind the sign-in/sign-up response, which would
        // otherwise bounce straight back to /login via RequireAuth before the
        // session catches up. A reload reads the now-set cookie fresh.
        window.location.href = "/today";
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    await signIn.social({ provider: "google", callbackURL: `${window.location.origin}/today` });
  }

  return (
    <div className="login-page nebula grain" data-moment="decompress">
      <div className="login-inner">
        {/* Reuses the landing nav's brand treatment directly (UPDATES.md
            round 6 #3), centered, with the logo glyph, instead of a plain
            left-aligned text link. */}
        <Link to="/" className="login-brand landing-nav-brand">
          <span className="landing-nav-logo" aria-hidden="true">
            ✦
          </span>
          {t.common.appName}
        </Link>

        <div className="login-card glass">
          <h1>{mode === "signin" ? (language === "pt" ? "Bem-vindo de volta" : "Welcome back") : t.common.signUp}</h1>
          <p className="login-sub">
            {mode === "signin"
              ? language === "pt"
                ? "Entre para continuar escrevendo."
                : "Sign in to keep writing."
              : language === "pt"
                ? "Poucos segundos, depois direto pro onboarding."
                : "A few seconds, then straight into onboarding."}
          </p>

          <button type="button" className="button-secondary login-google" onClick={handleGoogle}>
            <GoogleIcon />
            {t.common.signInWithGoogle}
          </button>

          <div className="login-divider">
            <span />
            {language === "pt" ? "ou" : "or"}
            <span />
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === "signup" && (
              <input
                className="glass"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder={language === "pt" ? "Nome" : "Name"}
              />
            )}
            <input
              className="glass"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder={t.common.email}
            />
            <input
              className="glass"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder={t.common.password}
            />
            <button type="submit" className="button-primary" disabled={submitting}>
              {submitting ? t.common.loading : mode === "signin" ? t.common.signIn : t.common.signUp}
            </button>
          </form>

          <button type="button" className="login-switch" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin"
              ? language === "pt"
                ? "Novo por aqui? Criar uma conta"
                : "New here? Create an account"
              : language === "pt"
                ? "Voltar pro login"
                : "Back to sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
