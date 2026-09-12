export const GuideView = () => (
  <section className="guide-view">
    <h1>Guide</h1>
    <p className="lede">
      Write a decision brief, choose a model, and run the council.
    </p>
    <div className="guide-section">
      <h2>The council</h2>
      <dl>
        <dt>Opportunity</dt>
        <dd>Mara makes the case for acting and suggests an experiment.</dd>
        <dt>Evidence</dt>
        <dd>Ivo checks the facts and assumptions in your brief.</dd>
        <dt>Risk</dt>
        <dd>Sana looks for failure modes and ways to limit the downside.</dd>
        <dt>Chair</dt>
        <dd>The Chair reads their reports and writes a recommendation.</dd>
      </dl>
      <p>
        The analysts use your selected model in separate calls. They do not see
        each other’s reports. There are no external research tools. Scores are
        model self-assessments, not measured probabilities.
      </p>
    </div>
    <div className="guide-section">
      <h2>Models & BYOK</h2>
      <p>
        Free NVIDIA models run through OpenRouter using Conclave’s server key,
        when configured. Every other hosted model needs your own API key. NVIDIA
        and OpenRouter use the same OpenRouter key. Your provider handles
        billing.
      </p>
      <p>
        Choose a model in the composer or Settings. Add your key to load the
        provider’s catalog. Keys stay in this tab’s memory and clear on reload.
        Use the eye button to reveal a key, or Forget this key to remove it.
      </p>
      <p>
        For Ollama or LM Studio, enter a loopback endpoint and the exact model
        ID. Remote OpenAI-compatible endpoints require HTTPS. The model must
        support structured output.
      </p>
    </div>
    <div className="guide-section">
      <h2>Offline preview</h2>
      <p>
        Offline produces a deterministic sample memo without calling a model.
        Use it to try the format. It is not an AI assessment.
      </p>
    </div>
    <div className="guide-section">
      <h2>Your data</h2>
      <p>
        Live runs send your brief and key through the Conclave server to the
        selected provider. Keys are never saved or exported. Use HTTPS when
        hosting beyond localhost.
      </p>
      <p>
        The most recent 50 completed decisions stay in unencrypted local storage
        in this browser. Library lets you reopen or export them as Markdown.
        There is no account or cloud sync. Clearing browser site data deletes
        saved decisions.
      </p>
    </div>
  </section>
);
