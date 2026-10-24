import assert from "node:assert/strict";
import { readFile, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const appRoot = join(packageRoot, "test/fixtures/next-app");
const nextBin = join(packageRoot, "node_modules/next/dist/bin/next");

test("runs a real Next.js App Router build with page splitting", async () => {
  await rm(join(appRoot, ".next"), { recursive: true, force: true });
  await rm(join(appRoot, "next-env.d.ts"), { force: true });

  try {
    const result = spawnSync(process.execPath, [nextBin, "build"], {
      cwd: appRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
        NO_COLOR: "1",
      },
      timeout: 240_000,
    });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const cssDir = join(appRoot, ".next/static/css");
    const cssFiles = await readdir(cssDir);
    const commonFile = cssFiles.find(
      (fileName) => !fileName.startsWith("page-"),
    );

    assert.ok(commonFile, "expected a common CSS asset");
    assert.ok(cssFiles.includes("page-index.css"), "expected page-index.css");
    assert.ok(cssFiles.includes("page-about.css"), "expected page-about.css");

    const [common, home, about] = await Promise.all([
      readFile(join(cssDir, commonFile), "utf8"),
      readFile(join(cssDir, "page-index.css"), "utf8"),
      readFile(join(cssDir, "page-about.css"), "utf8"),
    ]);

    assert.match(common, /\.shared/);
    assert.match(common, /\.layout-shell/);
    assert.doesNotMatch(common, /\.legacy-popup/);
    assert.doesNotMatch(common, /\.home-hero/);
    assert.doesNotMatch(common, /\.about-card/);
    assert.match(home, /\.home-hero/);
    assert.match(about, /\.about-card/);
    assert.match(result.stdout, /\[css-doctor\]/);
    assert.match(result.stdout, /Dead code eliminated/);
  } finally {
    await rm(join(appRoot, ".next"), {
      recursive: true,
      force: true,
    });
    await rm(join(appRoot, "next-env.d.ts"), { force: true });
  }
});
