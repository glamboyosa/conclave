import { pickerProviders, providerMeta } from "./providers";

const agents = [
  {
    id: "optimist",
    name: "Mara",
    role: "Opportunity",
    monogram: "M",
    bg: "bg-[#dce6d5]",
    brief:
      "Argues the strongest evidence-based case for action: the mechanism that creates value, the cheapest informative experiment, and the evidence that would weaken her position.",
  },
  {
    id: "analyst",
    name: "Ivo",
    role: "Evidence",
    monogram: "I",
    bg: "bg-[#dddce9]",
    brief:
      "Separates known facts from assumptions, names the most consequential unknown, and defines the measurable threshold that would reverse his position.",
  },
  {
    id: "skeptic",
    name: "Sana",
    role: "Risk",
    monogram: "S",
    bg: "bg-[#eadbd4]",
    brief:
      "Names the most plausible failure mode, the hidden opportunity cost, and what would make the choice hard to reverse — then offers one concrete guardrail.",
  },
];

const byokProviders = pickerProviders.filter((id) => providerMeta[id].key === "required");

const copy =
  "mb-[10px] max-w-[640px] text-[13px] leading-[1.7] text-pretty text-body";

export function GuideView() {
  return (
    <section className="mx-auto max-w-[780px]">
      <div className="eyebrow">
        <span>Guide</span> How it works
      </div>
      <h1 className="text-[clamp(42px,5vw,62px)]">How Conclave thinks.</h1>
      <p className="lede">
        Conclave turns one decision brief into three independent analyst
        positions and a chair’s memo. It runs on your machine, on whatever
        model you choose.
      </p>

      <div className="section-label">
        <span>01 · Three analysts, one chair</span>
        <i />
      </div>
      <div className="mb-[18px] grid grid-cols-3 gap-3 max-[850px]:grid-cols-1">
        {agents.map((agent) => (
          <article
            className="rounded-2xl bg-paper p-[19px] shadow-[0_1px_1px_rgba(20,30,23,0.04),0_6px_22px_rgba(28,37,31,0.05)]"
            key={agent.id}
          >
            <div
              className={`relative mb-[14px] grid size-[34px] place-items-center rounded-full font-mono text-[11px] ${agent.bg}`}
            >
              {agent.monogram}
              <span className="absolute right-0 bottom-px size-[7px] rounded-full border-2 border-paper bg-[#5ba66e]" />
            </div>
            <strong className="block text-[12px]">{agent.name}</strong>
            <small className="mt-[2px] mb-[10px] block font-mono text-[9px] uppercase tracking-[0.08em] text-[#92968f]">
              {agent.role}
            </small>
            <p className="m-0 text-[11px] leading-[1.6] text-pretty text-[#737873]">
              {agent.brief}
            </p>
          </article>
        ))}
      </div>
      <p className={copy}>
        The three analysts work in parallel and cannot see one another’s
        output. Independence reduces anchoring, so the chair receives genuinely
        different positions instead of three paraphrases. The chair reads all
        three and writes the memo: a recommendation, a confidence score, the
        productive tensions, three next moves, and the assumptions the
        recommendation depends on.
      </p>

      <div className="section-label">
        <span>02 · Structured, not vibes</span>
        <i />
      </div>
      <p className={copy}>
        Every agent answers against a strict schema — thesis, detail, signal,
        score — which is validated before the chair runs. Your brief is passed
        to the model as untrusted data, and each role’s instructions reject
        commands found inside it. Confidence measures support in your brief
        only: the council has no research tools and makes no claims about the
        outside world.
      </p>

      <div className="section-label">
        <span>03 · Bring any model</span>
        <i />
      </div>
      <p className={copy}>
        The default is NVIDIA Nemotron 3 Super on OpenRouter’s free tier,
        covered by Conclave’s shared key — nothing to configure. Every NVIDIA
        model runs through OpenRouter the same way: free routes need no key at
        all, paid ones take your own OpenRouter key. For anyone else, pick a
        model in the picker and paste that provider’s key. The picker loads
        each provider’s live model catalog; without a key it shows a short
        list of popular models.
      </p>
      <div className="mt-[4px] mb-[14px] flex flex-wrap gap-[7px]" role="list">
        <span
          role="listitem"
          className="rounded-full bg-lime px-[10px] py-[6px] font-mono text-[10px] font-medium text-[#1d2520]"
        >
          OpenRouter · Free default
        </span>
        <span
          role="listitem"
          className="rounded-full bg-lime px-[10px] py-[6px] font-mono text-[10px] font-medium text-[#1d2520]"
        >
          NVIDIA · via OpenRouter
        </span>
        {byokProviders.map((id) => (
          <span
            role="listitem"
            className="rounded-full bg-[#eeeee9] px-[10px] py-[6px] font-mono text-[10px] text-[#565c56]"
            key={id}
          >
            {providerMeta[id].name}
          </span>
        ))}
      </div>
      <p className={copy}>
        Keys live in this tab’s memory, are sent only to the local Conclave
        server when you run the council, and are never written to storage.
        Closing the tab forgets them.
      </p>

      <div className="section-label">
        <span>04 · Private by design</span>
        <i />
      </div>
      <p className={copy}>
        There is no account, server database, sync, or analytics. Decision
        records live in this browser’s local storage — the 50 most recent —
        and any record exports as Markdown. Clearing site data removes the
        library. The offline council needs no network at all.
      </p>
    </section>
  );
}
