import type { BrowserActor } from "../../../browser.ts";
import type { NotionLikeUiAdapter } from "../types.ts";

async function visible(
  actor: BrowserActor,
  selector: string,
  timeoutMs = 3_000
): Promise<boolean> {
  try {
    await actor.page.locator(selector).first().waitFor({ state: "visible", timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function ensure(
  actor: BrowserActor,
  selector: string,
  label: string,
  timeoutMs = 10_000
): Promise<void> {
  if (!(await visible(actor, selector, timeoutMs))) {
    throw new Error(`Missing ${label} using selector ${selector}`);
  }
}

async function text(actor: BrowserActor, selector: string): Promise<string> {
  return actor.page.locator(selector).first().innerText().catch(() => "");
}

async function texts(actor: BrowserActor, selector: string): Promise<string[]> {
  return actor.page
    .locator(selector)
    .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() ?? "").filter(Boolean))
    .catch(() => []);
}

async function click(actor: BrowserActor, selector: string, timeoutMs = 10_000): Promise<void> {
  await ensure(actor, selector, "click target", timeoutMs);
  await actor.page.locator(selector).first().click({ timeout: timeoutMs });
}

async function fill(actor: BrowserActor, selector: string, value: string, timeoutMs = 10_000): Promise<void> {
  await ensure(actor, selector, "input", timeoutMs);
  await actor.page.locator(selector).first().fill(value, { timeout: timeoutMs });
}

async function press(actor: BrowserActor, selector: string, key: string, timeoutMs = 10_000): Promise<void> {
  await ensure(actor, selector, "keypress target", timeoutMs);
  await actor.page.locator(selector).first().press(key, { timeout: timeoutMs });
}

async function paste(actor: BrowserActor, selector: string, value: string, timeoutMs = 10_000): Promise<void> {
  await ensure(actor, selector, "paste target", timeoutMs);
  const locator = actor.page.locator(selector).first();
  await locator.click({ timeout: timeoutMs });
  await actor.page.evaluate(async (textValue) => navigator.clipboard.writeText(textValue), value).catch(() => undefined);
  await locator.press("ControlOrMeta+V");
}

export function createUiAdapter(): NotionLikeUiAdapter {
  return { visible, ensure, click, fill, text, texts, press, paste };
}
