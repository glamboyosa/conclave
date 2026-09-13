import { useEffect, useRef } from "react";

const defaultMessages = [
  "The Chair is considering your message…",
  "Waiting for the model’s reply…",
  "Your follow-up is still being processed…",
  "The reply will appear here…",
];

export const DiscussionPending = ({ messages = defaultMessages }: { messages?: string[] }) => {
  const container = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const element = container.current;

    if (!element) return;
    let visible = false;

    const update = () => {
      element.dataset.paused = String(!visible || document.hidden);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });

    observer.observe(element);
    document.addEventListener("visibilitychange", update);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <p
      className="discussion-hint discussion-pending"
      role="status"
      ref={container}
      data-paused="true"
    >
      <span className="sr-only">{messages === defaultMessages ? "Waiting for the Chair’s reply." : messages[0]}</span>
      {messages.map((message, index) => (
        <span
          className="discussion-pending-message"
          aria-hidden="true"
          key={message}
          style={{ animationDelay: `${index * 3}s` }}
        >
          {message}
        </span>
      ))}
    </p>
  );
};
