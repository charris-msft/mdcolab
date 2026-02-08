import { NextResponse } from "next/server";
import { execSync } from "child_process";

// GET /api/ai/health — check if Copilot CLI is installed and SDK loads
export async function GET() {
  const checks: Record<string, string> = {};

  // Check CLI
  try {
    const version = execSync("copilot --version", { timeout: 5000, encoding: "utf-8" }).trim();
    checks.cli = `OK (${version})`;
  } catch {
    checks.cli = "NOT FOUND";
  }

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
