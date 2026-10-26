import { randomBytes } from "node:crypto";
import type { FaultClass } from "../../findings/types";

export type XssPayload = {
  token: string;
  body: string;
  faultClass: FaultClass;
};

function token(): string {
  return `mb_${randomBytes(8).toString("hex")}`;
}

/** DOM/HTML-body XSS oracle via img onerror. */
export function buildXssPayload(): XssPayload {
  const t = token();
  return {
    token: t,
    faultClass: "reflected-xss",
    body: `<img src=x onerror="window.__MB_XSS__='${t}'">`
  };
}

/** Attribute-breakout XSS oracle (closes value="..." then injects a tag). */
export function buildAttrXssPayload(): XssPayload {
  const t = token();
  return {
    token: t,
    faultClass: "attr-xss",
    body: `"><img src=x onerror="window.__MB_XSS__='${t}'">`
  };
}

export function payloadsForCalibration(): XssPayload[] {
  return [buildXssPayload(), buildAttrXssPayload()];
}
