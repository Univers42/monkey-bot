/**
 * Baseline form-xss run against the seeded mutant-lab target.
 * Evidence is written under ./artifacts/.
 */
import { runFormXssBot } from "../src/bots/form-xss/runner";
import { parseFormXssBotInput } from "../src/bots/form-xss/schema";

async function main(): Promise<void> {
  const input = parseFormXssBotInput({
    targetId: "mutant-lab-reflected-xss",
    writeArtifact: true,
    timeoutMs: 30_000
  });
  const result = await runFormXssBot(input);
  console.log(JSON.stringify(result, null, 2));
  if (!result.probeTrusted || result.findings.length < 1) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
