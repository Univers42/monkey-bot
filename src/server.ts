import express from "express";
import { runBot } from "./bot";

type RunBody = {
  url?: string;
  waitForSelector?: string;
  timeoutMs?: number;
};

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/run", async (req, res) => {
  const body = req.body as RunBody;

  if (!body.url) {
    return res.status(400).json({ error: "Missing required field: url" });
  }

  try {
    const result = await runBot({
      url: body.url,
      waitForSelector: body.waitForSelector,
      timeoutMs: body.timeoutMs
    });

    return res.status(200).json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown bot error";
    return res.status(500).json({ ok: false, error: message });
  }
});

app.listen(port, "0.0.0.0", () => {
  process.stdout.write(`monkey-bot listening on port ${port}\n`);
});