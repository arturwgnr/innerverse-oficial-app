import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { Oracle } from "../components/Oracle.jsx";

const DURATIONS = [1, 3, 5, 10];

// Hardcoded to the one track Artur dropped in /music (synced to
// public/music by scripts/sync-assets.js). If more tracks show up later,
// this can grow into a small picker, one file is fine for now.
const TRACK_URL = encodeURI("/music/Cellomano - Gratitude.mp3");

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Mindfulness() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [durationMin, setDurationMin] = useState(3);
  const [phase, setPhase] = useState("pick"); // pick | running | done
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  function start() {
    setSecondsLeft(durationMin * 60);
    setPhase("running");
    audioRef.current?.play().catch(() => {
      // Autoplay can be blocked before any user gesture on some browsers,
      // the click that triggered start() usually satisfies it, this is a
      // quiet fallback if it doesn't.
    });
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current);
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          setPhase("done");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function stopEarly() {
    clearInterval(intervalRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPhase("pick");
  }

  function toggleMute() {
    setMuted((m) => {
      if (audioRef.current) audioRef.current.muted = !m;
      return !m;
    });
  }

  return (
    <div className="mindfulness-page nebula grain" data-moment="decompress">
      <audio ref={audioRef} src={TRACK_URL} loop preload="none" />

      <button type="button" className="entry-back mindfulness-back" onClick={() => navigate("/today")}>
        ← {language === "pt" ? "Voltar" : "Back"}
      </button>

      <div className="mindfulness-inner">
        <Oracle size={168} variant="hi" className="onboarding-hero-oracle" float={phase !== "running"} />

        {phase === "pick" && (
          <>
            <h1>{language === "pt" ? "Um momento pra você" : "Take a moment for yourself"}</h1>
            <p className="onboarding-note">
              {language === "pt"
                ? "Escolha quanto tempo você quer. Sem pressa, sem estrutura."
                : "Choose how long you want. No rush, no structure."}
            </p>
            <div className="mindfulness-durations">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`onboarding-option glass ${durationMin === d ? "active" : ""}`}
                  onClick={() => setDurationMin(d)}
                >
                  {d} {language === "pt" ? "min" : "min"}
                </button>
              ))}
            </div>
            <button type="button" className="button-primary mindfulness-start" onClick={start}>
              {language === "pt" ? "Começar" : "Begin"}
            </button>
          </>
        )}

        {phase === "running" && (
          <>
            <p className="mindfulness-timer">{formatTime(secondsLeft)}</p>
            <p className="onboarding-note">
              {language === "pt" ? "Respire. Isso é tudo que precisa acontecer agora." : "Breathe. That's all that needs to happen right now."}
            </p>
            <div className="mindfulness-controls">
              <button type="button" className="button-secondary" onClick={toggleMute}>
                {muted ? (language === "pt" ? "Ativar som" : "Unmute") : language === "pt" ? "Silenciar" : "Mute"}
              </button>
              <button type="button" className="button-ghost" onClick={stopEarly}>
                {language === "pt" ? "Encerrar" : "End early"}
              </button>
            </div>
          </>
        )}

        {phase === "done" && (
          <>
            <h1>{language === "pt" ? "Pronto." : "That's it."}</h1>
            <p className="onboarding-note">
              {language === "pt"
                ? "Nada que você precisa fazer com isso agora. Só notar que você parou."
                : "Nothing you need to do with this now. Just notice that you stopped."}
            </p>
            <button type="button" className="button-primary mindfulness-start" onClick={() => navigate("/today")}>
              {language === "pt" ? "Voltar pro Today" : "Back to Today"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
