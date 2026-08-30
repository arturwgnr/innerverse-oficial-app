import { useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { Oracle } from "../components/Oracle.jsx";

// Multiple choice for every question except the last, which stays free
// text (minimizes friction, per UPDATES.md). Options mirror the ones
// already validated in /references/dashboard's onboarding.tsx.
const QUESTIONS = [
  {
    id: "loudest_moment",
    en: "When does your head get loudest?",
    pt: "Quando sua cabeça fica mais barulhenta?",
    options: [
      { en: "First thing in the morning", pt: "Logo de manhã" },
      { en: "Mid-afternoon", pt: "No meio da tarde" },
      { en: "Late at night", pt: "Tarde da noite" },
      { en: "It varies", pt: "Varia" },
    ],
  },
  {
    id: "working_on",
    en: "What are you here to work on?",
    pt: "No que você está aqui pra trabalhar?",
    options: [
      { en: "Understanding my moods", pt: "Entender meus humores" },
      { en: "Stopping the spiral", pt: "Parar a espiral" },
      { en: "Being less numb", pt: "Ficar menos anestesiado(a)" },
      { en: "I'm not sure yet", pt: "Ainda não sei" },
    ],
  },
  {
    id: "processing_style",
    en: "How do you process things best?",
    pt: "Como você processa as coisas melhor?",
    options: [
      { en: "Writing it out", pt: "Escrevendo" },
      { en: "Saying it aloud", pt: "Falando em voz alta" },
      { en: "Short notes, fast", pt: "Notas curtas, rápido" },
      { en: "Depends on the day", pt: "Depende do dia" },
    ],
  },
  {
    id: "writing_persona",
    en: "Which version of you shows up when you write?",
    pt: "Qual versão de você aparece quando você escreve?",
    options: [
      { en: "The one nobody else sees", pt: "A que mais ninguém vê" },
      { en: "A calmer, more reasonable one", pt: "Uma mais calma, mais razoável" },
      { en: "Whoever I need to be to get through it", pt: "Quem eu precisar ser pra aguentar" },
      { en: "Still figuring that out", pt: "Ainda estou descobrindo" },
    ],
  },
];

export function Onboarding() {
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const [showIntro, setShowIntro] = useState(true);
  const [step, setStep] = useState(0);
  const [birthDate, setBirthDate] = useState("");
  const [answers, setAnswers] = useState({});
  const [finalAnswer, setFinalAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const steps = useMemo(() => ["birth_date", ...QUESTIONS.map((q) => q.id), "final"], []);
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
        birthDate,
        responses: { ...answers, biggest_life_goal: finalAnswer },
      });
      // Reload rather than a client navigate: useOnboardingStatus only
      // refetches when auth state changes, so it would still report
      // "not completed" and bounce straight back here otherwise.
      window.location.href = "/today";
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (showIntro) {
    return (
      <div className="onboarding-page nebula grain" data-moment="morning">
        <div className="onboarding-card onboarding-intro">
          <Oracle size={168} variant="onboarding" className="onboarding-hero-oracle" />
          <h1>{language === "pt" ? "Antes de começar" : "Before we start"}</h1>
          <p className="onboarding-note">
            {language === "pt"
              ? "Algumas perguntas honestas, rápidas. Nada aqui te prende numa trilha fixa, elas só me ajudam a te encontrar onde você realmente está agora."
              : "A few honest, quick questions. Nothing here locks you into a fixed track, they just help me meet you where you actually are right now."}
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
            <textarea
              rows={5}
              autoFocus
              className="onboarding-textarea glass"
              placeholder={language === "pt" ? "Diga com suas palavras." : "Say it plainly."}
              value={finalAnswer}
              onChange={(e) => setFinalAnswer(e.target.value)}
            />
            <div className="onboarding-footer">
              <button type="button" className="button-primary" disabled={!finalAnswer || submitting} onClick={handleFinish}>
                {submitting ? t.common.loading : language === "pt" ? "Entrar no meu innerverse" : "Enter my innerverse"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
