import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowUp, MessageSquare, RotateCcw } from "lucide-react";
import { readDiscussionResponse } from "../../discussion-client";
import type { DiscussionMessage } from "../../engine";
import type { ModelConnection } from "../../providers";
import type { DecisionRecord } from "../../storage";
import { DiscussionPending } from "./DiscussionPending";
import { Button } from "../ui/button";

const DiscussionMarkdown = lazy(() => import("./DiscussionMarkdown"));

type Props = {
  record: DecisionRecord;
  connection: ModelConnection;
  controls: ReactNode;
  onSave: (messages: DiscussionMessage[]) => void;
  onRevise: () => void;
  onDecision: (animate: boolean) => void;
};

export const DecisionDiscussion = ({
  record,
  connection,
  controls,
  onSave,
  onRevise,
  onDecision,
}: Props) => {
  const [open, setOpen] = useState(Boolean(record.discussion?.length));
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const followLatest = useRef(false);
  const messages = record.discussion ?? [];
  const offline = connection.provider === "demo";
  const full = messages.length >= (offline ? 40 : 39);

  useEffect(() => () => controller.current?.abort(), []);

  const scrollToLatest = (animate = false) => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    bottom.current?.scrollIntoView({
      block: "end",
      behavior: animate && !reducedMotion ? "smooth" : "instant",
    });
  };

  useLayoutEffect(() => {
    if (open && followLatest.current) scrollToLatest();
  }, [open, messages.length, pending, error, streamingText]);

  useEffect(() => {
    if (!open || !body.current) return;

    let previousScroll = window.scrollY;

    const onScroll = () => {
      const scrollingUp = window.scrollY < previousScroll;
      previousScroll = window.scrollY;

      const remaining =
        document.documentElement.scrollHeight -
        window.innerHeight -
        window.scrollY;

      if (scrollingUp && remaining > 128) followLatest.current = false;
    };

    const observer = new ResizeObserver(() => {
      if (followLatest.current) scrollToLatest();
    });

    observer.observe(body.current);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [open]);

  const send = async () => {
    if (pending || !draft.trim() || full) return;
    followLatest.current = true;
    const content = draft.trim();
    const next: DiscussionMessage[] = [...messages, { role: "user", content }];
    setError("");

    if (offline) {
      onSave(next);
      setDraft("");
      input.current?.focus();

      return;
    }

    const request = new AbortController();
    controller.current = request;
    setPending(true);
    setStreamingText("");
    const startedAt = performance.now();
    let bufferedText = "";
    let reveal = false;

    const timer = setTimeout(() => {
      reveal = true;

      if (!request.signal.aborted) setStreamingText(bufferedText);
    }, 1500);

    try {
      const response = await fetch("/api/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        signal: request.signal,
        body: JSON.stringify({
          brief: record.brief,
          memo: record.result,
          messages: next,
          connection,
        }),
      });

      const text = await readDiscussionResponse(response, (value) => {
        bufferedText = value;

        if (reveal && !request.signal.aborted) setStreamingText(value);
      });

      if (!reveal && !request.signal.aborted) {
        const remaining = Math.max(0, 1500 - (performance.now() - startedAt));
        await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      }

      if (request.signal.aborted) return;
      onSave([...next, { role: "assistant", content: text }]);
      setDraft("");
      input.current?.focus();
    } catch (cause) {
      if (!request.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "The reply failed. Your message is still here; try again.",
        );
    } finally {
      clearTimeout(timer);

      if (!request.signal.aborted) {
        setPending(false);
        setStreamingText("");
      }
    }
  };

  return (
    <section className="decision-discussion" aria-label="Decision discussion">
      <Button
        variant="outline"
        aria-expanded={open}
        onClick={() => {
          followLatest.current = !open;
          setOpen(!open);

          if (!open)
            setTimeout(() => input.current?.focus({ preventScroll: true }), 0);
        }}
      >
        <MessageSquare data-icon="inline-start" />
        {open ? "Hide discussion" : "Discuss this decision"}
      </Button>
      {open && (
        <div className="discussion-body" ref={body}>
          <h2>Discuss this decision</h2>
          <p className="discussion-hint">
            Challenge an assumption, add context, or ask a question. The saved
            memo stays as it is until you revise it.
          </p>
          <div className="discussion-messages" aria-label="Conversation">
            {messages.map((message, index) => (
              <article
                className={`discussion-message discussion-${message.role}`}
                key={index}
              >
                <strong>{message.role === "user" ? "You" : "Chair"}</strong>
                <Suspense fallback={<p>{message.content}</p>}>
                  <DiscussionMarkdown content={message.content} />
                </Suspense>
              </article>
            ))}
            {pending && (
              <article className="discussion-message discussion-assistant" aria-busy="true">
                <strong>Chair</strong>
                {streamingText ? (
                  <Suspense fallback={<p>{streamingText}</p>}>
                    <DiscussionMarkdown content={streamingText} />
                  </Suspense>
                ) : <DiscussionPending />}
              </article>
            )}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <div className="composer discussion-composer">
              <label className="sr-only" htmlFor="discussion-message">
                Your follow-up
              </label>
              <textarea
                id="discussion-message"
                ref={input}
                value={draft}
                maxLength={4000}
                disabled={pending || full}
                placeholder="What would you like to question or add?"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey) &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              <div className="composer-toolbar">
                {controls}
                <Button
                  type="submit"
                  className="send-button"
                  aria-label={offline ? "Add note" : "Send follow-up"}
                  disabled={pending || !draft.trim() || full}
                >
                  <ArrowUp />
                </Button>
              </div>
            </div>
            {pending ? (
              <p className="discussion-hint" role="status">{streamingText ? "Receiving the Chair’s reply…" : "Waiting for the Chair’s reply…"}</p>
            ) : (
              <p className="discussion-hint" role="status">
                {full
                  ? "This discussion has reached its limit. Revise the decision to continue."
                  : offline
                    ? "Offline preview: notes are saved, but no AI replies are generated."
                    : "Replies use the selected model. Your discussion is saved in this browser."}
              </p>
            )}
          </form>
          {error && (
            <p className="discussion-error" role="alert">
              {error}
            </p>
          )}
          <Button
            variant="secondary"
            disabled={pending || messages.length === 0}
            onClick={onRevise}
          >
            <RotateCcw data-icon="inline-start" /> Revise decision
          </Button>
          <p className="discussion-hint">
            Run the council again with this discussion. The revision is saved
            separately.
          </p>
          <div id="discussion-latest" ref={bottom} aria-hidden="true" />
          <nav
            className="discussion-navigation"
            aria-label="Decision navigation"
          >
            <Button
              variant="ghost"
              onClick={(event) => {
                followLatest.current = false;
                onDecision(event.detail > 0);
              }}
            >
              <ArrowUp data-icon="inline-start" /> Back to decision
            </Button>
            <Button
              variant="ghost"
              onClick={(event) => {
                followLatest.current = true;
                scrollToLatest(event.detail > 0);
              }}
            >
              <ArrowDown data-icon="inline-start" /> Latest reply
            </Button>
          </nav>
        </div>
      )}
    </section>
  );
};
