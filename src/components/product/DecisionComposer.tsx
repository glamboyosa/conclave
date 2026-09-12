import { useEffect, type ReactNode, type RefObject } from "react";
import { ArrowUp, CircleAlert } from "lucide-react";
import { Button } from "../ui/button";

type Props = {
  brief: string;
  error: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  connection: ReactNode;
  onChange: (value: string) => void;
  onRun: () => void;
  onExample: () => void;
};

export const DecisionComposer = ({
  brief,
  error,
  textareaRef,
  connection,
  onChange,
  onRun,
  onExample,
}: Props) => {
  useEffect(() => {
    const field = textareaRef.current;

    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(360, Math.max(96, field.scrollHeight))}px`;
  }, [brief, textareaRef]);

  return (
    <section className="composer-view">
      <h1>What are you deciding?</h1>
      <div className={`composer ${error ? "has-error" : ""}`}>
        <textarea
          id="decision-brief"
          ref={textareaRef}
          aria-label="Decision brief"
          aria-invalid={Boolean(error) && brief.trim().length < 20}
          aria-describedby={error ? "composer-error" : "brief-help"}
          value={brief}
          maxLength={4000}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Describe your decision. Add any context or constraints…"
          onKeyDown={(event) => {
            if (
              (event.metaKey || event.ctrlKey) &&
              event.key === "Enter" &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              onRun();
            }
          }}
        />
        <div className="composer-toolbar">
          {connection}
          <Button
            className="send-button"
            aria-label="Convene council"
            title="Convene council (⌘ / Ctrl + Enter)"
            onClick={onRun}
          >
            <ArrowUp />
          </Button>
        </div>
      </div>
      <div className="composer-meta">
        <button className="sample" onClick={onExample}>
          Use an example
        </button>
        <span id="brief-help">
          20–4,000 characters{" "}
          <span className="shortcut">· ⌘ / Ctrl + Enter</span>
        </span>
        {brief.length > 0 && (
          <span className="char-count">
            {brief.length.toLocaleString()} / 4,000
          </span>
        )}
      </div>
      {error && (
        <div id="composer-error" className="error" role="alert">
          <CircleAlert size={16} />
          {error}
        </div>
      )}
    </section>
  );
};
