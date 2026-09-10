import { useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { Oracle } from "../components/Oracle.jsx";

// Full replacement of the question set (EDITS.md round 2 #6, explicit
// founder override of CLAUDE.md's "mirror the prototype's onboarding
// exactly, do not invent new questions" rule, see CLAUDE.md's Onboarding
// section for the note on record). Four multiple choice, followed by the
// open text closing question restored in EDITS.md round 3 (round 2 had
// intentionally dropped it, round 3 called that a bug and asked for it
// back, see the "final" step below).
const QUESTIONS = [
  {
    id: "need_more_of",
    en: "What do you need more of right now?",
    pt: "Do que você precisa mais agora?",
    options: [
      { en: "Clarity", pt: "Clareza" },
      { en: "Calm", pt: "Calma" },
      { en: "Motivation", pt: "Motivação" },
      { en: "Direction", pt: "Direção" },
      { en: "Nothing, I'm good", pt: "Nada, estou bem" },
    ],
  },
  {
    id: "get_better_at",
    en: "What would you like to get better at?",
    pt: "No que você gostaria de melhorar?",
    options: [
      { en: "Understanding yourself", pt: "Entender a si mesmo(a)" },
      { en: "Managing your emotions", pt: "Gerenciar suas emoções" },
      { en: "Breaking unhealthy patterns", pt: "Quebrar padrões pouco saudáveis" },
      { en: "Staying focused", pt: "Manter o foco" },
      { en: "Growing as a person", pt: "Crescer como pessoa" },
    ],
  },
  {
    id: "gets_in_your_way",
    en: "What tends to get in your way?",
    pt: "O que costuma atrapalhar você?",
    options: [
      { en: "Overthinking", pt: "Pensar demais" },
      { en: "Procrastination", pt: "Procrastinação" },
      { en: "Stress", pt: "Estresse" },
      { en: "Self-doubt", pt: "Insegurança" },
      { en: "I'm not sure", pt: "Não tenho certeza" },
    ],
  },
  {
    id: "when_mind_stuck",
    en: "What do you usually do when your mind gets stuck?",
    pt: "O que você costuma fazer quando sua mente trava?",
    options: [
      { en: "Think about it more", pt: "Pensar mais sobre isso" },
      { en: "Distract myself", pt: "Me distrair" },
      { en: "Talk to someone", pt: "Conversar com alguém" },
      { en: "Write it down", pt: "Escrever" },
      { en: "Take action", pt: "Agir" },
    ],
  },
];

export function Onboarding() {
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const [showIntro, setShowIntro] = useState(true);
  const [step, setStep] = useState(0);
  const [preferredName, setPreferredName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [answers, setAnswers] = useState({});
  const [finalAnswer, setFinalAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const steps = useMemo(() => ["preferred_name", "birth_date", ...QUESTIONS.map((q) => q.id), "final"], []);
  const totalSteps = steps.length;
  const isLastStep = step === totalSteps - 1;

  function next() {
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleFinish() {
    setSubmitting(true);
    try {
      await api.post("/api/onboarding", {
        preferredName,
        birthDate,
        responses: { ...answers, biggest_life_goal: finalAnswer },
      });
      // Reload rather than a client navigate: useOnboardingStatus only
      // refetches when auth state changes, so it would still report
      // "not completed" and bounce straight back here otherwise, leaving
      // the user stuck on this screen even though onboarding actually
      // succeeded (EDITS.md round 3, "onboarding gets stuck").
      window.location.href = "/today";
    } catch (err) {
      showToast(err.message, "error");
      setSubmitting(false);
    }
    // No finally: on success this navigates away immediately, resetting
    // submitting here too would just flash the button back to its normal
    // state for the instant before the reload actually happens.
  }

  if (showIntro) {
    return (
      <div className="onboarding-page nebula grain" data-moment="morning">
        <div className="onboarding-card onboarding-intro">
          <Oracle size={168} variant="onboarding" className="onboarding-hero-oracle" />
          <h1>{language === "pt" ? "Antes de começar" : "Before we start"}</h1>
          <p className="onboarding-note">
            {language === "pt"
              ? "Algumas perguntas pra eu entender o que está acontecendo por baixo da superfície."
              : "A few questions to help me understand what's going on beneath the surface."}
          </p>
          <div className="onboarding-footer">
            <button type="button" className="button-primary" onClick={() => setShowIntro(false)}>
              {language === "pt" ? "Vamos lá" : "Let's go"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentStepId = steps[step];
  const currentQuestion = QUESTIONS.find((q) => q.id === currentStepId);
  const eyebrow = isLastStep
    ? language === "pt"
      ? "Última"
      : "Last one"
    : `${language === "pt" ? "Etapa" : "Step"} ${step + 1} ${language === "pt" ? "de" : "of"} ${totalSteps}`;

  return (
    <div className="onboarding-page nebula grain" data-moment="morning">
      <div className="onboarding-card">
        <div className="onboarding-progress">
          {steps.map((_, i) => (
            <span key={i} className={`onboarding-progress-seg ${i <= step ? "filled" : ""}`} />
          ))}
        </div>

        {isLastStep && (
          <div className="onboarding-oracle">
            <Oracle size={168} variant="notes" className="onboarding-hero-oracle" />
          </div>
        )}

        <div className="onboarding-step-head">
          <button
            type="button"
            className="onboarding-back"
            onClick={back}
            disabled={step === 0}
            aria-label={t.common.back}
          >
            ←
          </button>
          <p className="onboarding-eyebrow">{eyebrow}</p>
        </div>

        {currentStepId === "preferred_name" && (
          <>
            <h1>{t.onboarding.preferredName}</h1>
            <p className="onboarding-note">{t.onboarding.preferredNameHelp}</p>
            <input
              type="text"
              className="onboarding-input glass"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              placeholder={language === "pt" ? "Como devo te chamar?" : "What should I call you?"}
              autoFocus
              required
            />
            <div className="onboarding-footer">
              <button type="button" className="button-primary" disabled={!preferredName.trim()} onClick={next}>
                {t.common.continue}
              </button>
            </div>
          </>
        )}

        {currentStepId === "birth_date" && (
          <>
            <h1>{t.onboarding.birthDate}</h1>
            <p className="onboarding-note">{t.onboarding.birthDateHelp}</p>
            <input
              type="date"
              className="onboarding-input glass"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
            />
            <div className="onboarding-footer">
              <button type="button" className="button-primary" disabled={!birthDate} onClick={next}>
                {t.common.continue}
              </button>
            </div>
          </>
        )}

        {currentQuestion && (
          <>
            <h1>{currentQuestion[language]}</h1>
            <div className="onboarding-options">
              {currentQuestion.options.map((option) => (
                <button
                  key={option.en}
                  type="button"
                  className={`onboarding-option glass ${answers[currentQuestion.id] === option.en ? "active" : ""}`}
                  onClick={() => {
                    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: option.en }));
                    next();
                  }}
                >
                  {option[language]}
                </button>
              ))}
            </div>
          </>
        )}

        {isLastStep && (
          <>
            <h1>{t.onboarding.finalQuestion}</h1>
            <p className="onboarding-note">{t.onboarding.finalQuestionHelp}</p>
            <textarea
              rows={5}
              autoFocus
              className="onboarding-textarea glass"
              placeholder={language === "pt" ? "Diga com suas palavras." : "Say it plainly."}
              value={finalAnswer}
              onChange={(e) => setFinalAnswer(e.target.value)}
            />
            <div className="onboarding-footer">
              <button type="button" className="button-primary" disabled={!finalAnswer.trim() || submitting} onClick={handleFinish}>
                {submitting ? t.common.loading : language === "pt" ? "Entrar no meu innerverse" : "Enter my innerverse"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
