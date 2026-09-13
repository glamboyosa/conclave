import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Toast } from "@base-ui/react/toast";
import { Check, X } from "lucide-react";

export const ConnectionToasts = () => {
  const { toasts } = Toast.useToastManager();
  const viewport = useRef<HTMLDivElement>(null);
  const [touchExpanded, setTouchExpanded] = useState(false);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch")
        setTouchExpanded(event.target instanceof Node && Boolean(viewport.current?.contains(event.target)));
    };

    document.addEventListener("pointerdown", onPointerDown);

    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const stackHeight = toasts.reduce((height, toast) => height + (toast.height ?? 0), 0) + Math.max(0, toasts.length - 1) * 8;

  const viewportStyle: CSSProperties & { "--toast-stack-height": string } = {
    "--toast-stack-height": `${stackHeight}px`,
  };

  return (
    <Toast.Portal>
      <Toast.Viewport
        ref={viewport}
        className="toast-viewport"
        data-touch-expanded={touchExpanded || undefined}
        style={viewportStyle}
      >
        {toasts.map((toast, index) => (
          <Toast.Root key={toast.id} toast={toast} className="connection-toast" data-behind={index > 0 || undefined}>
            <Check size={18} aria-hidden="true" />
            <Toast.Content className="toast-content">
              <Toast.Title className="toast-title" />
              <Toast.Description className="toast-description" />
            </Toast.Content>
            {toast.actionProps && (
              <Toast.Action className="toast-action" />
            )}
            <Toast.Close
              className="icon-button"
              aria-label="Dismiss notification"
              aria-hidden={false}
            >
              <X size={16} />
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
};
