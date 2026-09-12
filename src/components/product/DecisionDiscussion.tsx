import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, MessageSquare, RotateCcw } from "lucide-react";
import { z } from "zod";
import type { DiscussionMessage } from "../../engine";
import type { ModelConnection } from "../../providers";
import type { DecisionRecord } from "../../storage";
import { DiscussionPending } from "./DiscussionPending";
import { Button } from "../ui/button";

type Props = {
  record: DecisionRecord;
  connection: ModelConnection;
  controls: ReactNode;
  onSave: (messages: DiscussionMessage[]) => void;
  onRevise: () => void;
};

export const DecisionDiscussion = ({
  record,
  connection,
  controls,
  onSave,
  onRevise,
}: Props) => {
  const [open, setOpen] = useState(Boolean(record.discussion?.length));
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const messages = record.discussion ?? [];
  const offline = connection.provider === "demo";
  const full = messages.length >= (offline ? 40 : 39);

  useEffect(() => () => controller.current?.abort(), []);

  const send = async () => {
    if (pending || !draft.trim() || full) return;
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

    try {
      const response = await fetch("/api/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: request.signal,
        body: JSON.stringify({
          brief: record.brief,
          memo: record.result,
          messages: next,
          connection,
        }),
      });

      const value = await response.json();

      if (!response.ok)
        throw new Error(z.object({ error: z.string() }).parse(value).error);

      const { text } = z
        .object({ text: z.string().trim().min(1).max(12000) })
        .parse(value);

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
      if (!request.signal.aborted) setPending(false);
    }
  };

  return (
    <section className="decision-discussion" aria-label="Decision discussion">
      <Button
        variant="outline"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);

          if (!open) setTimeout(() => input.current?.focus(), 0);
        }}
      >
        <MessageSquare data-icon="inline-start" />
        {open ? "Hide discussion" : "Discuss this decision"}
      </Button>
      {open && (
        <div className="discussion-body">
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
                <p>{message.content}</p>
              </article>
            ))}
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
              <DiscussionPending />
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
        </div>
      )}
    </section>
  );
};
