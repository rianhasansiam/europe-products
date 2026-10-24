export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
};

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export function readApiError(payload: unknown, fallback: string): string {
  const record = asRecord(payload);
  if (!record) return fallback;

  if (record.fieldErrors && typeof record.fieldErrors === "object") {
    const fieldEntries = Object.entries(
      record.fieldErrors as Record<string, string[] | undefined>,
    );
    const messages = fieldEntries
      .flatMap(([_, errors]) => errors || [])
      .filter(
        (msg): msg is string => typeof msg === "string" && Boolean(msg.trim()),
      );
    if (messages.length > 0) {
      return messages.join(". ");
    }
  }

  const GENERIC_MSG = "Please review the highlighted fields";

  if (typeof record.message === "string" && record.message.trim()) {
    if (!record.message.includes(GENERIC_MSG)) {
      return record.message;
    }
  }
  if (typeof record.error === "string" && record.error.trim()) {
    if (!record.error.includes(GENERIC_MSG)) {
      return record.error;
    }
  }

  return fallback;
}

export async function readApiData<T>(
  response: Response,
  fallbackError: string,
): Promise<T> {
  let payload: unknown;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    throw new Error(fallbackError);
  }

  const envelope = payload as ApiEnvelope<T>;
  if (!response.ok || !envelope?.success) {
    throw new Error(readApiError(payload, fallbackError));
  }

  return envelope.data;
}
