import { ApiEnvelope } from "@/lib/api-response";

export async function readApiData<T>(response: Response): Promise<T> {
  const json = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !json.success) {
    throw new Error(json.message || "请求失败");
  }

  return json.data as T;
}

export async function readApiEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  return (await response.json()) as ApiEnvelope<T>;
}

