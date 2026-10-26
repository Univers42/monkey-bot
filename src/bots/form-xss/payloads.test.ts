import { describe, expect, it } from "vitest";
import { buildAttrXssPayload, buildXssPayload } from "./payloads";

describe("XSS payloads", () => {
  it("builds unique reflected XSS payloads", () => {
    const a = buildXssPayload();
    const b = buildXssPayload();

    expect(a.faultClass).toBe("reflected-xss");
    expect(a.token).toMatch(/^mb_[a-f0-9]{16}$/);
    expect(b.token).not.toBe(a.token);
    expect(a.body).toContain(a.token);
    expect(a.body).toContain("onerror");
  });

  it("builds unique attribute XSS breakout payloads", () => {
    const a = buildAttrXssPayload();
    expect(a.faultClass).toBe("attr-xss");
    expect(a.body.startsWith('">')).toBe(true);
    expect(a.body).toContain("onerror");
    expect(a.body).toContain(a.token);
  });
});
