import { Toast } from "@base-ui/react/toast";
import { Check, X } from "lucide-react";

export const ConnectionToasts = () => {
  const { toasts } = Toast.useToastManager();

  return (
    <Toast.Portal>
      <Toast.Viewport className="toast-viewport">
        {toasts.map((toast) => (
          <Toast.Root key={toast.id} toast={toast} className="connection-toast">
            <Check size={18} aria-hidden="true" />
            <Toast.Content>
              <Toast.Title className="toast-title" />
              <Toast.Description className="toast-description" />
            </Toast.Content>
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
