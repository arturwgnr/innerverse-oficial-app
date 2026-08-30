import { useState } from "react";

// A live, clickable demo of the correction loop instead of prose describing
// it (UPDATES.md: "lightweight interactive showcase" for the landing page).
// The sample entry and insight are clearly framed as an example, never
// implying this is the visitor's own data.
export function CleanMirrorDemo({ language }) {
  const [verdict, setVerdict] = useState(null);

  const copy = language === "pt"
    ? {
        eyebrow: "O espelho limpo, ao vivo",
        title: "Toda entrada vira um insight assim. Tente você mesmo.",
        entryLabel: "Um exemplo de entrada",
        entry: "“Acordei já reprisando a reunião de ontem. Disse a mim mesmo que ia deixar pra lá até o almoço. Não deixei.”",
        insightLabel: "Exemplo de insight",
        category: "Linguagem",
        title2: "Você diz “deveria” bem antes do humor cair.",
        body: "Num exemplo como esse, a frase com “deveria” aparece logo antes de três das quatro entradas mais pesadas da semana.",
        confidence: "Confiança média (exemplo)",
        wrong: "Não foi bem isso",
        true_: "Verdade",
        wrongResponse: "Anotado. No seu Innerverse de verdade, essa correção vira parte do que ele sabe sobre você, ligada direto a esse insight.",
        trueResponse: "Confirmado. É exatamente esse tipo de detalhe que constrói o seu perfil vivo ao longo do tempo.",
      }
    : {
        eyebrow: "The clean mirror, live",
        title: "Every entry becomes an insight like this one. Try it yourself.",
        entryLabel: "A sample entry",
        entry: "“Woke up already replaying yesterday's meeting. Told myself I'd let it go by lunch. Didn't.”",
        insightLabel: "Sample insight",
        category: "Language",
        title2: "You say “should” right before the mood drops.",
        body: "In an example like this one, the sentence with “should” shows up right before three of the week's four heaviest entries.",
        confidence: "Medium confidence (example)",
        wrong: "That's not it",
        true_: "True",
        wrongResponse: "Noted, thanks. On your real Innerverse, this correction becomes part of what it knows about you, permanently attached to this insight.",
        trueResponse: "Confirmed. This is exactly the kind of detail your living profile builds from over time.",
      };

  return (
    <div className="mirror-demo">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h2 className="mirror-demo-title">{copy.title}</h2>

      <div className="mirror-demo-grid">
        <div className="mirror-demo-entry glass">
          <p className="mirror-demo-label">{copy.entryLabel}</p>
          <p className="mirror-demo-entry-text">{copy.entry}</p>
        </div>

        <div className="mirror-demo-arrow">→</div>

        <div className="mirror-demo-insight glass">
          <p className="mirror-demo-label">{copy.insightLabel}</p>
          <span className="pattern-category">{copy.category}</span>
          <h3>{copy.title2}</h3>
          <p className="mirror-demo-body">{copy.body}</p>
          <div className="pattern-meta">
            <span className="pattern-confidence">{copy.confidence}</span>
            <span className="correction-buttons">
              <button type="button" className={verdict === "wrong" ? "active" : ""} onClick={() => setVerdict("wrong")}>
                {copy.wrong}
              </button>
              <button type="button" className={`accent ${verdict === "true" ? "active" : ""}`} onClick={() => setVerdict("true")}>
                {copy.true_}
              </button>
            </span>
          </div>
          {verdict && <p className="mirror-demo-response">{verdict === "wrong" ? copy.wrongResponse : copy.trueResponse}</p>}
        </div>
      </div>
    </div>
  );
}
