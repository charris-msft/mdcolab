import { NextResponse } from "next/server";
import { execSync } from "child_process";

// GET /api/ai/health — check if Copilot CLI is installed and SDK loads
export async function GET() {
  const checks: Record<string, string> = {};

  // Check CLI via PATH
  try {
    const version = execSync("copilot --version", { timeout: 5000, encoding: "utf-8" }).trim();
    checks.cli = `OK (${version})`;
  } catch {
    checks.cli = "NOT FOUND on PATH";
  }

  // Try to find the binary
  try {
    const details = execSync("ls -la /usr/local/bin/copilot && file /usr/local/bin/copilot 2>&1 || echo 'not found'", {
      timeout: 10000, encoding: "utf-8",
    }).trim();
    checks.cliDetails = details;
  } catch (e: unknown) {
    checks.cliDetails = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Try running with absolute path
  try {
    const version = execSync("/usr/local/bin/copilot --version 2>&1", { timeout: 10000, encoding: "utf-8" }).trim();
    checks.cliAbsolute = `OK (${version})`;
  } catch (e: unknown) {
    const msg = e instanceof Error ? (e as { stderr?: Buffer }).stderr?.toString() || e.message : String(e);
    checks.cliAbsolute = `FAILED: ${msg.slice(0, 300)}`;
  }

  // Try running via node directly
  try {
    const version = execSync("node /usr/local/lib/node_modules/@github/copilot/npm-loader.js --version 2>&1", { timeout: 10000, encoding: "utf-8" }).trim();
    checks.cliViaNode = `OK (${version})`;
  } catch (e: unknown) {
    const msg = e instanceof Error ? (e as { stderr?: Buffer }).stderr?.toString() || e.message : String(e);
    checks.cliViaNode = `FAILED: ${msg.slice(0, 300)}`;
  }

  // Check shebang
  try {
    const head = execSync("head -1 /usr/local/lib/node_modules/@github/copilot/npm-loader.js", { timeout: 5000, encoding: "utf-8" }).trim();
    checks.shebang = head;
  } catch {
    checks.shebang = "unknown";
  }

  // Check npm global path
  try {
    const prefix = execSync("npm config get prefix", { timeout: 5000, encoding: "utf-8" }).trim();
    checks.npmPrefix = prefix;
  } catch {
    checks.npmPrefix = "unknown";
  }

  checks.path = process.env.PATH || "unset";

  // Check SDK
  try {
    const sdk = await import("@github/copilot-sdk");
    checks.sdk = sdk.CopilotClient ? "OK" : "LOADED BUT NO CopilotClient";
  } catch (err: unknown) {
    checks.sdk = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
  }

  checks.node = process.version;

  const healthy = checks.cli.startsWith("OK") && checks.sdk === "OK";
  return NextResponse.json({ healthy, checks }, { status: healthy ? 200 : 503 });
}
