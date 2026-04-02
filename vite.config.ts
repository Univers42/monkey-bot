import { defineConfig, loadEnv, Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import { runBot } from "./src/bot";
import { openApiDocument } from "./src/swagger";

type RunBody = {
  url?: string;
  waitForSelector?: string;
  timeoutMs?: number;
};

function readJsonBody(req: IncomingMessage): Promise<RunBody> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf8");
    });
    req.on("end", () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data) as RunBody);
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function redirect(res: ServerResponse, location: string): void {
  res.statusCode = 308;
  res.setHeader("Location", location);
  res.end();
}

function normalizePath(pathname: string): string {
  if (pathname === "/") {
    return pathname;
  }

  return pathname.replace(/\/+$/, "");
}

function docsHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>monkey-bot API docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: './openapi.json',
        dom_id: '#swagger-ui'
      });
    </script>
  </body>
</html>`;
}

function apiPlugin(): Plugin {
  const handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const method = req.method || "GET";
    const path = (req.url || "").split("?")[0];
    const normalizedPath = normalizePath(path);

    if (method === "GET" && path === "/docs") {
      redirect(res, "/docs/");
      return;
    }

    if (method === "GET" && path === "/docs/openapi.json/") {
      redirect(res, "/docs/openapi.json");
      return;
    }

    if (method === "GET" && normalizedPath === "/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    if (method === "GET" && normalizedPath === "/docs/openapi.json") {
      sendJson(res, 200, openApiDocument);
      return;
    }

    if (method === "GET" && normalizedPath === "/docs") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(docsHtml());
      return;
    }

    if (method === "POST" && normalizedPath === "/run") {
      readJsonBody(req)
        .then(async (body) => {
          if (!body.url) {
            sendJson(res, 400, { error: "Missing required field: url" });
            return;
          }

          try {
            const result = await runBot({
              url: body.url,
              waitForSelector: body.waitForSelector,
              timeoutMs: body.timeoutMs
            });

            sendJson(res, 200, { ok: true, result });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown bot error";
            sendJson(res, 500, { ok: false, error: message });
          }
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Invalid request body";
          sendJson(res, 400, { error: message });
        });
      return;
    }

    next();
  };

  return {
    name: "monkey-bot-api",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    }
  };
}

export default defineConfig(({ mode }) => {
  const projectRoot = resolve(process.cwd(), "..");
  const env = {
    ...loadEnv(mode, projectRoot, ""),
    ...loadEnv(mode, process.cwd(), "")
  };
  const port = Number(env.PORT || process.env.PORT || 3000);

  process.env.PORT = String(port);
  process.env.CHROMIUM_PATH = env.CHROMIUM_PATH || process.env.CHROMIUM_PATH || "/usr/bin/chromium-browser";
  process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD || process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD || "1";

  return {
    plugins: [apiPlugin()],
    server: {
      host: "0.0.0.0",
      port
    },
    preview: {
      host: "0.0.0.0",
      port
    }
  };
});