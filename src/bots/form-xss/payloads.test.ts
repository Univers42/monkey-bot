import { describe, expect, it } from "vitest";
import { buildXssPayload } from "./payloads";

describe("buildXssPayload", () => {
  it("embeds a unique token in an img onerror oracle payload", () => {
    const a = buildXssPayload();
    const b = buildXssPayload();

    expect(a.token).toMatch(/^mb_[a-f0-9]{16}$/);
    expect(b.token).not.toBe(a.token);
    expect(a.body).toContain(a.token);
    expect(a.body).toContain("onerror");
    expect(a.body).toContain("__MB_XSS__");
  });
});
