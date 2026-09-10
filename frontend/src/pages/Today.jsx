import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useMoment } from "../context/MomentContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useOnboardingStatus } from "../context/OnboardingContext.jsx";
import { MOMENTS } from "../lib/moments.js";
import { api } from "../lib/api.js";
import { enqueueEntry } from "../lib/entryQueue.js";
import { pickLine } from "../lib/toastCopy.js";
import { Oracle } from "../components/Oracle.jsx";
import { Carousel } from "../components/Carousel.jsx";

const LOGIN_GREETING_FLAG = "innerverse.justSignedIn";

const MOODS = [1, 2, 3, 4, 5, 6];

// Several alternatives per moment, not just one, "Another template" (below)
// actually has something to cycle through now.
const DEFAULT_PROMPTS = {
  morning: [
    {
      en: "What would make today feel like it went well?",
      pt: "O que faria hoje parecer que valeu a pena?",
    },
    {
      en: "What are you walking into today?",
      pt: "No que você está entrando hoje?",
    },
    {
      en: "What's one thing you don't want to forget to do today?",
      pt: "Qual é uma coisa que você não quer esquecer de fazer hoje?",
    },
  ],
  afternoon: [
    {
      en: "How does the day feel so far, and does anything need adjusting?",
      pt: "Como o dia está indo até agora, precisa ajustar algo?",
    },
    {
      en: "What's taken more energy than you expected today?",
      pt: "O que tomou mais energia do que você esperava hoje?",
    },
    {
      en: "Is there anything from this morning still on your mind?",
      pt: "Tem algo de hoje de manhã que ainda está na sua cabeça?",
    },
  ],
  night: [
    {
      en: "What actually happened today, honestly?",
      pt: "O que realmente aconteceu hoje, com honestidade?",
    },
    {
      en: "What's the truest sentence you could write about today?",
      pt: "Qual é a frase mais verdadeira que você poderia escrever sobre hoje?",
    },
    {
      en: "What are you carrying into tomorrow that you'd rather leave here?",
      pt: "O que você está levando pra amanhã que preferia deixar aqui?",
    },
  ],
  decompress: [{ en: "", pt: "" }],
};

export function Today() {
  const { language, t } = useLanguage();
  const { moment, setMoment, isManual, detected } = useMoment();
  const { showToast } = useToast();
  const { preferredName, loading: onboardingLoading } = useOnboardingStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  // The bottom nav's center "+" shortcut (EDITS.md round 2 #1) links here
  // with ?compose=1 to jump straight to the write stage, current moment
  // already pre-selected by useMoment(), skipping the arrival screen
  // entirely instead of making a quick add still take two taps.
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [stage, setStage] = useState(() =>
    searchParams.get("compose") ? "write" : "arrival",
  );
  const [useOwnPrompt, setUseOwnPrompt] = useState(false);
  const [ownPrompt, setOwnPrompt] = useState("");
  const [text, setText] = useState("");
  const [mood, setMood] = useState(null);
  const [entryDate, setEntryDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);
  const [customQuestions, setCustomQuestions] = useState([]);
  const [templateIndex, setTemplateIndex] = useState(0);
  const [proposal, setProposal] = useState(null);
  const [suggestingChange, setSuggestingChange] = useState(false);

  useEffect(() => {
    if (searchParams.get("compose")) setSearchParams({}, { replace: true });
    // Only ever needs to fire once, off the initial URL, not every time
    // searchParams itself changes (that would fight setSearchParams below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Oracle-voiced sign-in greeting (UPDATES.md round 4 #2): Login.jsx sets a
  // flag right before its full-page redirect to /today, this is the first
  // place after that reload that has both a mounted toast and a resolved
  // preferredName to greet with. Waits on onboardingLoading rather than
  // firing on a still-null preferredName, otherwise the very first render
  // after reload would greet before the name has actually loaded.
  useEffect(() => {
    if (onboardingLoading) return;
    let flagged = false;
    try {
      flagged = window.localStorage.getItem(LOGIN_GREETING_FLAG) === "1";
      if (flagged) window.localStorage.removeItem(LOGIN_GREETING_FLAG);
    } catch {
      return;
    }
    if (flagged) {
      showToast(pickLine(t.toasts.loginGreeting, { name: preferredName || (language === "pt" ? "você" : "you") }), "success");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingLoading]);

  // Random line per carousel slot (UPDATES.md round 5 #3), recomputed only
  // when the moment actually changes, not on every render, so it doesn't
  // reroll mid-visit for no reason.
  const oracleCardLines = useMemo(
    () => ({
      knowYou: pickLine(t.today.oracleLines[moment].knowYou),
      chronicle: pickLine(t.today.oracleLines[moment].chronicle),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moment, language],
  );

  const isRetroactive = entryDate !== new Date().toISOString().slice(0, 10);
  const today = useMemo(
    () =>
      new Date().toLocaleDateString(language === "pt" ? "pt-BR" : "en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [language],
  );

  function selectMoment(nextMoment) {
    setMoment(nextMoment);
    setSwitcherOpen(false);
    setStage("arrival");
    setUseOwnPrompt(false);
    setOwnPrompt("");
  }

  useEffect(() => {
    setTemplateIndex(0);
    if (moment === "decompress") {
      setCustomQuestions([]);
      return;
    }
    api
      .get(`/api/profile/question-set/${moment}`)
      .then(setCustomQuestions)
      .catch(() => setCustomQuestions([]));

    api
      .get("/api/profile/question-proposals")
      .then((proposals) =>
        setProposal(proposals.find((p) => p.moment === moment) || null),
      )
      .catch(() => setProposal(null));
  }, [moment]);

  async function respondToProposal(decision) {
    if (!proposal) return;
    await api.post(`/api/profile/question-proposals/${proposal.id}/respond`, {
      action: decision,
    });
    setProposal(null);
    if (decision !== "reject") {
      api
        .get(`/api/profile/question-set/${moment}`)
        .then(setCustomQuestions)
        .catch(() => {});
    }
  }

  async function requestSuggestion() {
    setSuggestingChange(true);
    try {
      const created = await api.post(
        "/api/profile/question-proposals/generate",
        { moment },
      );
      setProposal(created);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSuggestingChange(false);
    }
  }

  // Adaptive questions win once they exist, otherwise the generic starting
  // templates, either way this is a real list "Another template" can cycle
  // through, not a single fixed string.
  const templates = useMemo(() => {
    if (customQuestions.length > 0) return customQuestions;
    return (DEFAULT_PROMPTS[moment] || [])
      .map((p) => p[language] || p.en)
      .filter(Boolean);
  }, [customQuestions, moment, language]);

  function cycleTemplate() {
    setUseOwnPrompt(false);
    setTemplateIndex((i) =>
      templates.length ? (i + 1) % templates.length : 0,
    );
  }

  const prompt = useMemo(() => {
    if (useOwnPrompt) return ownPrompt;
    return templates[templateIndex % templates.length] || templates[0] || "";
  }, [useOwnPrompt, ownPrompt, templates, templateIndex]);

  const arrivalPreviewPrompt = templates[0] || "";

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    const payload = {
      moment,
      mode: "full",
      language,
      prompt: prompt || undefined,
      textContent: text,
      mood: mood || undefined,
      occurredAt: new Date(`${entryDate}T12:00:00`).toISOString(),
    };
    try {
      await api.post("/api/entries", payload);
      setText("");
      setMood(null);
      setEntryDate(new Date().toISOString().slice(0, 10));
      showToast(pickLine(t.toasts.entrySaved), "success");
    } catch (err) {
      // Save resilience (UPDATES.md round 4 #3): the write itself failing
      // outright used to just lose the draft behind an error toast. Now it's
      // queued and retried on the next app load or reconnect (see
      // AppShell.jsx's flush), analysis then runs normally off that eventual
      // successful POST.
      enqueueEntry(payload);
      setText("");
      setMood(null);
      setEntryDate(new Date().toISOString().slice(0, 10));
      showToast(pickLine(t.toasts.entryQueued), "error");
    } finally {
      setSaving(false);
    }
  }

  if (stage === "write") {
    return (
      <div className="entry-screen">
        <div className="entry-topbar">
          <button
            type="button"
            className="entry-back"
            onClick={() => setStage("arrival")}
          >
            ← {t.today.backToArrival}
          </button>
          <span className="entry-moment-label">{t.moments[moment].label}</span>
        </div>

        <button
          type="button"
          className={`retro-pill ${isRetroactive ? "active" : ""}`}
          onClick={() => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            setEntryDate(
              isRetroactive
                ? new Date().toISOString().slice(0, 10)
                : d.toISOString().slice(0, 10),
            );
          }}
        >
          <span className="retro-pill-dot">{isRetroactive ? "↺" : "•"}</span>
          {isRetroactive
            ? language === "pt"
              ? "Retroativo"
              : "Retroactive"
            : language === "pt"
              ? "Ao vivo · hoje"
              : "Live entry · today"}
        </button>

        <input
          type="date"
          className="entry-date-input"
          value={entryDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setEntryDate(e.target.value)}
        />

        <form onSubmit={handleSubmit}>
          {moment !== "decompress" && (
            <section className="entry-prompt-card glass">
              {useOwnPrompt ? (
                <input
                  autoFocus
                  className="entry-own-prompt"
                  value={ownPrompt}
                  onChange={(e) => setOwnPrompt(e.target.value)}
                  placeholder={
                    language === "pt"
                      ? "Pergunte algo a si mesmo..."
                      : "Ask yourself something..."
                  }
                />
              ) : (
                prompt && <h1>{prompt}</h1>
              )}

              <div className="entry-prompt-actions">
                <button type="button" onClick={cycleTemplate}>
                  {language === "pt" ? "Outro template" : "Another template"}
                </button>
                <button
                  type="button"
                  className={useOwnPrompt ? "active" : ""}
                  onClick={() => setUseOwnPrompt(true)}
                >
                  {language === "pt"
                    ? "Minha própria pergunta"
                    : "Write my own question"}
                </button>
              </div>
            </section>
          )}

          <textarea
            className="entry-textarea glass"
            rows={9}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              language === "pt"
                ? "Ninguém lê isso além de você."
                : "No one reads this but you."
            }
            required
          />

          <div className="mood-picker">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                className={`mood-chip mood-${m} ${mood === m ? "active" : ""}`}
                onClick={() => setMood(mood === m ? null : m)}
              >
                {t.moods[m]}
              </button>
            ))}
          </div>

          <button
            type="submit"
            className="entry-save button-primary"
            disabled={saving}
          >
            {saving
              ? t.common.loading
              : language === "pt"
                ? "Salvar entrada"
                : "Save entry"}
          </button>
        </form>

        {moment !== "decompress" && !proposal && (
          <button
            type="button"
            className="button-ghost suggest-change"
            onClick={requestSuggestion}
            disabled={suggestingChange}
          >
            {suggestingChange
              ? t.common.loading
              : language === "pt"
                ? "Sugerir mudança nessas perguntas"
                : "Suggest a change to these questions"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="today-arrival">
      <div className="today-header">
        <div>
          {preferredName && (
            <p className="today-greeting">
              {t.today.greeting.replace("{name}", preferredName)}
            </p>
          )}
          <p className="today-date">{today}</p>
          <button
            type="button"
            className="today-moment-toggle"
            onClick={() => setSwitcherOpen((v) => !v)}
          >
            <span className="today-moment-label">
              {t.moments[moment].label}
            </span>
            <span className="today-moment-caret">
              {switcherOpen ? "▲" : "▼"}
            </span>
          </button>
          <p className="today-moment-meta">
            {isManual
              ? `${language === "pt" ? "Trocado manualmente" : "Switched manually"} · ${language === "pt" ? "auto" : "auto"}: ${t.moments[detected].label}`
              : `${language === "pt" ? "Detectado automaticamente" : "Auto-detected"} · ${t.moments[moment].window}`}
          </p>
        </div>
      </div>

      {switcherOpen && (
        <div className="moment-switcher">
          {MOMENTS.map((m) => (
            <button
              key={m}
              type="button"
              className={`glass ${m === moment ? "active" : ""}`}
              onClick={() => selectMoment(m)}
            >
              <span className="moment-switcher-label">
                {t.moments[m].label}
              </span>
              <span className="moment-switcher-window">
                {t.moments[m].window}
              </span>
            </button>
          ))}
        </div>
      )}

      {proposal && (
        <div className="proposal-banner glass">
          <p>{proposal.rationale}</p>
          <ul>
            {proposal.proposed_questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
          <div className="proposal-actions">
            <button
              type="button"
              className="button-ghost"
              onClick={() => respondToProposal("reject")}
            >
              {language === "pt" ? "Não, obrigado" : "No thanks"}
            </button>
            <button
              type="button"
              className="button-primary"
              onClick={() => respondToProposal("accept")}
            >
              {language === "pt"
                ? "Usar essas perguntas"
                : "Use these questions"}
            </button>
          </div>
        </div>
      )}

      <section className="arrival-card glass">
        <p className="arrival-tagline">{t.moments[moment].tagline}</p>
        {arrivalPreviewPrompt && <h2>{arrivalPreviewPrompt}</h2>}
        <button
          type="button"
          className="button-primary arrival-write"
          onClick={() => setStage("write")}
        >
          {t.today.write}
        </button>
      </section>

      <div className="arrival-shortcuts">
        <Link to="/fast" className="shortcut-card glass">
          <p className="shortcut-title">{t.today.fastCardTitle}</p>
          <p className="shortcut-body">{t.today.fastCardBody}</p>
        </Link>
        <button
          type="button"
          className="shortcut-card glass"
          onClick={() => selectMoment("decompress")}
          disabled={moment === "decompress"}
        >
          <p className="shortcut-title">{t.today.decompressCardTitle}</p>
          <p className="shortcut-body">{t.today.decompressCardBody}</p>
        </button>
      </div>

      <Carousel autoAdvanceMs={7000}>
        {/* Two fixed slots, each with several phrasing variants picked at
            random per visit (UPDATES.md round 5 #3), rather than one flat
            line each. Each slot keeps its own fixed Oracle variant and link
            regardless of which line is showing. */}
        <section className="oracle-speech glass">
          <Oracle size={44} variant="main" float={false} />
          <div>
            <p>{oracleCardLines.knowYou}</p>
            <Link to="/about-me">{t.today.seeWhatIKnow} →</Link>
          </div>
        </section>

        <section className="oracle-speech glass">
          <Oracle size={44} variant="notes" float={false} />
          <div>
            <p>{oracleCardLines.chronicle}</p>
            <Link to="/analysis">{t.today.seeAnalysis} →</Link>
          </div>
        </section>

        <Link
          to="/mindfulness"
          className="oracle-speech mindfulness-card glass"
        >
          <Oracle size={44} variant="hi" float={false} />
          <div>
            <p>
              {language === "pt"
                ? "Tire um momento pra você. De 1 a 10 minutos ja podem te ajudar!"
                : "Take a moment for yourself. Just 1 to 10 minutes can make a difference!"}
            </p>
            <span className="mindfulness-card-cta">
              {language === "pt" ? "Começar →" : "Start →"}
            </span>
          </div>
        </Link>
      </Carousel>
    </div>
  );
}
