import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { authClient } from "../lib/authClient.js";
import { pickLine } from "../lib/toastCopy.js";
import { LanguageToggle } from "../components/LanguageToggle.jsx";
import { ScreenTitle } from "../components/AppShell.jsx";

// Complete settings screen (EDITS.md round 2 #1's navigation overhaul):
// name and birth date (both onboarding-collected, both editable here),
// password, and app preferences (language, moved here from the top bar per
// EDITS.md round 2 #1, no longer surfaced anywhere else).
export function Settings() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [preferredName, setPreferredName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    api
      .get("/api/settings")
      .then((data) => {
        setPreferredName(data.preferredName || "");
        setBirthDate(data.birthDate || "");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function handleSaveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await api.put("/api/settings", { preferredName, birthDate });
      showToast(pickLine(t.toasts.profileSaved), "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    setChangingPassword(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (error) throw new Error(error.message || t.common.genericError);
      setCurrentPassword("");
      setNewPassword("");
      showToast(pickLine(t.toasts.passwordChanged), "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="settings-page">
      <ScreenTitle eyebrow={t.settings.eyebrow} title={t.settings.title} />

      <section className="settings-section glass">
        <h2>{t.settings.profileHeading}</h2>
        <form onSubmit={handleSaveProfile}>
          <label className="settings-field">
            <span>{t.onboarding.preferredName}</span>
            <input
              type="text"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              disabled={!loaded}
              required
            />
          </label>
          <label className="settings-field">
            <span>{t.onboarding.birthDate}</span>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              disabled={!loaded}
              required
            />
          </label>
          <label className="settings-field">
            <span>{t.settings.email}</span>
            <input type="email" value={user?.email || ""} disabled readOnly />
          </label>
          <button type="submit" className="button-primary" disabled={savingProfile || !loaded}>
            {savingProfile ? t.common.loading : t.common.save}
          </button>
        </form>
      </section>

      <section className="settings-section glass">
        <h2>{t.settings.passwordHeading}</h2>
        <form onSubmit={handleChangePassword}>
          <label className="settings-field">
            <span>{t.settings.currentPassword}</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label className="settings-field">
            <span>{t.settings.newPassword}</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <button type="submit" className="button-primary" disabled={changingPassword}>
            {changingPassword ? t.common.loading : t.settings.changePassword}
          </button>
        </form>
      </section>

      <section className="settings-section glass">
        <h2>{t.settings.preferencesHeading}</h2>
        <div className="settings-field settings-language-field">
          <span>{t.settings.language}</span>
          <LanguageToggle />
        </div>
      </section>
    </div>
  );
}
