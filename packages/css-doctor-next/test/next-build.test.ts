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
    const homeFile = cssFiles.find((fileName) =>
      /^page-index\.[a-f0-9]{8}\.css$/.test(fileName),
    );
    const aboutFile = cssFiles.find((fileName) =>
      /^page-about\.[a-f0-9]{8}\.css$/.test(fileName),
    );

    assert.ok(commonFile, "expected a common CSS asset");
    assert.ok(homeFile, "expected page-index.[hash].css");
    assert.ok(aboutFile, "expected page-about.[hash].css");

    const [common, home, about] = await Promise.all([
      readFile(join(cssDir, commonFile), "utf8"),
      readFile(join(cssDir, homeFile), "utf8"),
      readFile(join(cssDir, aboutFile), "utf8"),
    ]);

    assert.match(common, /\.shared/);
    assert.match(common, /\.layout-shell/);
    assert.doesNotMatch(common, /\.legacy-popup/);
    assert.doesNotMatch(common, /\.home-hero/);
    assert.doesNotMatch(common, /\.about-card/);
    assert.match(home, /\.home-hero/);
    assert.match(about, /\.about-card/);

    const pageChunks = await readdir(join(appRoot, ".next/static/chunks/app"));
    const homeChunk = pageChunks.find((fileName) =>
      /^page-[^/]+\.js$/.test(fileName),
    );
    assert.ok(homeChunk, "expected the App Router page chunk");
    const pageChunkSource = await readFile(
      join(appRoot, ".next/static/chunks/app", homeChunk),
      "utf8",
    );
    assert.match(pageChunkSource, new RegExp(homeFile.replaceAll(".", "\\.")));

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
