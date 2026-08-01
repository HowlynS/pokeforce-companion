import { spawn } from "node:child_process";
import path from "node:path";
import {
  PUBLIC_DESIGN_CAPTURE_USAGE,
  buildPublicDesignCaptureMatrix,
  getPublicDesignCaptureOutputDirectory,
  parsePublicDesignCaptureArgs,
} from "../src/lib/public-design/capture";

function runPnpm(
  args: string[],
  environment: NodeJS.ProcessEnv = process.env
): Promise<number> {
  const pnpmEntryPoint = process.env.npm_execpath;
  if (!pnpmEntryPoint) {
    throw new Error(
      "pnpm execution metadata is missing; run this command through pnpm."
    );
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [pnpmEntryPoint, ...args], {
      cwd: process.cwd(),
      env: environment,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (signal) {
        reject(new Error(`pnpm terminated by signal ${signal}.`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

async function main(): Promise<void> {
  const options = parsePublicDesignCaptureArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(PUBLIC_DESIGN_CAPTURE_USAGE);
    return;
  }

  const matrix = buildPublicDesignCaptureMatrix(options.filters);
  const outputDirectory = getPublicDesignCaptureOutputDirectory(options.runId);
  process.stdout.write(
    `Preparing ${matrix.length} public design capture(s) in ${outputDirectory}\n`
  );

  const setupCode = await runPnpm(["public:design:fixtures", "setup"]);
  if (setupCode !== 0) {
    throw new Error(`Public design fixture setup failed with exit code ${setupCode}.`);
  }

  let captureCode = 1;
  try {
    captureCode = await runPnpm(
      [
        "exec",
        "playwright",
        "test",
        "e2e/public-design-capture.spec.ts",
        "--project=chromium",
        "--workers=1",
      ],
      {
        ...process.env,
        PUBLIC_DESIGN_CAPTURE: "1",
        PUBLIC_DESIGN_CAPTURE_RUN_ID: options.runId,
        PUBLIC_DESIGN_CAPTURE_FILTERS: JSON.stringify(options.filters),
      }
    );
  } finally {
    const cleanupCode = await runPnpm(["public:design:fixtures", "cleanup"]);
    if (cleanupCode !== 0) {
      throw new Error(
        `Public design fixture cleanup failed with exit code ${cleanupCode}.`
      );
    }
  }

  const manifestPath = path.join(outputDirectory, "manifest.json");
  process.stdout.write(`Capture manifest: ${manifestPath}\n`);
  if (captureCode !== 0) {
    throw new Error(`Public design capture failed with exit code ${captureCode}.`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Public design capture command failed."}\n`
  );
  process.exitCode = 1;
});
