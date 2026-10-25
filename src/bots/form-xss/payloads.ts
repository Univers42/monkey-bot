import { randomBytes } from "node:crypto";

export type XssPayload = {
  token: string;
  /** Value submitted into the form field */
  body: string;
};

/** Build a unique payload so oracle hits cannot collide with unrelated page scripts. */
export function buildXssPayload(): XssPayload {
  const token = `mb_${randomBytes(8).toString("hex")}`;
  // img onerror is a reliable DOM XSS oracle in local fixtures and many reflected sinks
  const body = `<img src=x onerror="window.__MB_XSS__='${token}'">`;
  return { token, body };
}
