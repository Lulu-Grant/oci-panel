export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export function apiOk<T>(data: T, init?: ResponseInit) {
  return Response.json({ success: true, data } satisfies ApiEnvelope<T>, init);
}

export function apiFail(message: string, status = 500) {
  return Response.json({ success: false, message } satisfies ApiEnvelope<never>, { status });
}

