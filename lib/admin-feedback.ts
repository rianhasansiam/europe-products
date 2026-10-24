import { confirm, toast, type ConfirmVariant } from "@/lib/feedback";

type ConfirmMajorActionOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
};

export function getActionErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  return error instanceof Error ? error.message : fallback;
}

export function notifyActionSuccess(message: string) {
  toast.success(message);
}

export function notifyActionError(error: unknown, fallback: string): string {
  const message = getActionErrorMessage(error, fallback);
  toast.error(message);
  return message;
}

export async function confirmMajorAction(
  options: ConfirmMajorActionOptions,
): Promise<boolean> {
  return confirm({
    cancelLabel: "Cancel",
    variant: "danger",
    ...options,
  });
}
