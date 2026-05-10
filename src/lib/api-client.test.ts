import { describe, expect, it } from "vitest";
import { readApiData, readApiEnvelope } from "@/lib/api-client";
import { apiFail, apiOk } from "@/lib/api-response";

describe("api envelope helpers", () => {
  it("reads data from successful API envelopes", async () => {
    const response = apiOk({ id: "account-1" });

    await expect(readApiData<{ id: string }>(response)).resolves.toEqual({ id: "account-1" });
  });

  it("throws the API message for failed envelopes", async () => {
    const response = apiFail("账户不存在", 404);

    await expect(readApiData(response)).rejects.toThrow("账户不存在");
  });

  it("can read the raw envelope when a caller needs status metadata", async () => {
    const response = apiOk({ supported: false });

    await expect(readApiEnvelope<{ supported: boolean }>(response)).resolves.toEqual({
      success: true,
      data: { supported: false },
    });
  });
});

