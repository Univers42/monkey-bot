#!/usr/bin/env node
/**
 * monkey-bot MCP — authorized security probes for Univers42 apps (Prismatica).
 * Stdio transport for Cursor (`.cursor/mcp.json`).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  PRISMATICA_BASE,
  calibrateMutants,
  checkSecurityHeaders,
  listConfiguredTargets,
  probeFormXss,
  scanPrismatica
} from "./tools";

function asText(result: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };
}

const server = new McpServer({
  name: "monkey-bot-security",
  version: "1.0.0"
});

server.tool(
  "calibrate_mutants",
  "Run Google-mutants calibration for form-xss. A probe is only trusted when must-kill mutants are killed and controls survive.",
  {
    timeoutMs: z.number().int().min(1000).optional().describe("Browser timeout in ms")
  },
  async ({ timeoutMs }) => asText(await calibrateMutants(timeoutMs))
);

server.tool(
  "list_targets",
  "List configured security targets (config/targets.json + targets.local.json) and bots.",
  {},
  async () => asText(listConfiguredTargets())
);

server.tool(
  "probe_form_xss",
  "Probe a named targetId or raw URL for reflected/attribute XSS. Always calibrates mutants first inside the bot. Report findings only when probeTrusted.",
  {
    targetId: z.string().optional().describe("Named target from config (e.g. prismatica-newsletter)"),
    url: z.string().url().optional().describe("Direct page URL if not using targetId"),
    formSelector: z.string().optional(),
    fieldSelector: z.string().optional(),
    submitSelector: z.string().optional(),
    timeoutMs: z.number().int().min(1000).optional(),
    writeArtifact: z.boolean().optional().describe("Write evidence JSON under ./artifacts/")
  },
  async (args) => asText(await probeFormXss(args))
);

server.tool(
  "check_security_headers",
  "Fetch security-relevant HTTP response headers. Observations are hypotheses, not findings, unless paired with an exploit path.",
  {
    url: z
      .string()
      .url()
      .optional()
      .describe(`URL to fetch (default ${PRISMATICA_BASE})`)
  },
  async ({ url }) => asText(await checkSecurityHeaders(url ?? PRISMATICA_BASE))
);

server.tool(
  "scan_prismatica",
  `Full Prismatica pass: calibrate mutants, probe every prismatica-* target in config, optionally check headers on ${PRISMATICA_BASE}. Org-owned authorized testing only.`,
  {
    timeoutMs: z.number().int().min(1000).optional(),
    includeHeaders: z.boolean().optional().describe("Also fetch security headers (default true)")
  },
  async (args) => asText(await scanPrismatica(args))
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
