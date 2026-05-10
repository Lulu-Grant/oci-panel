import { describe, expect, it } from "vitest";
import { isPublicRegistrationEnabled } from "@/lib/registration";

describe("registration policy", () => {
  it("defaults to enabled outside production for local setup", () => {
    expect(isPublicRegistrationEnabled({}, "development")).toBe(true);
    expect(isPublicRegistrationEnabled({}, "test")).toBe(true);
  });

  it("defaults to disabled in production", () => {
    expect(isPublicRegistrationEnabled({}, "production")).toBe(false);
  });

  it("allows an explicit environment override", () => {
    expect(isPublicRegistrationEnabled({ AUTH_REGISTRATION_ENABLED: "true" }, "production")).toBe(true);
    expect(isPublicRegistrationEnabled({ AUTH_REGISTRATION_ENABLED: "0" }, "development")).toBe(false);
  });
});

