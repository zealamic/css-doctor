import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { build } from "vite";

import { cssDoctor } from "../src/index";
import type { CssDoctorDiagnostics, CssDoctorViteOptions } from "../src/types";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const appRoot = join(packageRoot, "test/fixtures/app");

type EmittedAsset = {
  type: "asset";
  fileName: string;
  source: string | Uint8Array;
};

type PluginContextLike = {
  warn: (message: string) => void;
  getModuleInfo: (id: string) => { code?: string | null } | null;
  emitFile: (asset: EmittedAsset) => string;
};

type GenerateBundleHook = (
  this: PluginContextLike,
  options: unknown,
  bundle: Record<string, unknown>,
) => Promise<void>;

function hookFor(plugin: ReturnType<typeof cssDoctor>): GenerateBundleHook {
  const hook = plugin.generateBundle;

  if (typeof hook !== "function") {
    throw new Error("generateBundle hook is not a function");
  }

  return hook as unknown as GenerateBundleHook;
}

function asset(fileName: string, source: string): Record<string, unknown> {
  return {
    type: "asset",
    fileName,
    source,
    names: [],
    originalFileNames: [],
  };
}

function directContext(
  emitted: EmittedAsset[],
  warnings: string[] = [],
): PluginContextLike {
  return {
    warn: (message) => warnings.push(message),
    getModuleInfo: () => null,
    emitFile: (item) => {
      emitted.push(item);
      return String(emitted.length);
    },
  };
}

async function buildFixture(
  options: CssDoctorViteOptions = {},
): Promise<CssDoctorDiagnostics> {
  const captured: CssDoctorDiagnostics[] = [];

  await build({
    root: appRoot,
    logLevel: "silent",
    plugins: [
      cssDoctor({
        report: false,
        ...options,
        onDiagnostics: (result) => {
          captured.push(result);
        },
      }),
    ],
    build: {
      write: false,
      rollupOptions: {
        input: {
          pageA: join(appRoot, "page-a.html"),
          pageB: join(appRoot, "page-b.html"),
        },
      },
    },
  });

  const diagnostics = captured[0];
  assert.ok(diagnostics, "onDiagnostics should be called");
  return diagnostics;
}

test("splits CSS assets during a real Vite build", async () => {
  const diagnostics = await buildFixture({ minPageRatio: 0.75 });

  assert.equal(diagnostics.plugin, "vite-plugin-css-doctor");
  assert.equal(diagnostics.totalCssAssets, 2);
  assert.equal(diagnostics.analyzedCssAssets, 2);
  assert.equal(diagnostics.skippedCssAssets, 0);
  assert.equal(diagnostics.failedCssAssets, 0);
  assert.equal(diagnostics.totalSelectors, 4);
  assert.equal(diagnostics.splitApplied, true);
  assert.equal(diagnostics.pages.length, 2);
  assert.ok(
    diagnostics.pages.every((page) => (diagnostics.pageUsage[page] ?? 0) > 0),
  );

  assert.equal(diagnostics.deadCodeCount, 1);
  assert.equal(diagnostics.emittedPageChunks.length, 2);
  assert.ok(diagnostics.pageSpecificCssBytes > 0);
  assert.ok(diagnostics.files.every((file) => file.split !== undefined));

  const dead = diagnostics.usageMatrix.find(
    (stat) => stat.selector === ".legacy-popup",
  );
  assert.ok(dead);
  assert.equal(dead.pageCount, 0);
  assert.equal(dead.targetChunk, "dead");

  const pageA = diagnostics.usageMatrix.find(
    (stat) => stat.selector === ".page-a",
  );
  assert.ok(pageA);
  assert.equal(pageA.pageCount, 1);
  assert.match(pageA.targetChunk, /^page:/);
});

test("splits CSS using explicit pageUsage", async () => {
  const captured: CssDoctorDiagnostics[] = [];
  const emitted: EmittedAsset[] = [];
  const plugin = cssDoctor({
    report: false,
    pageUsage: {
      home: ["shared"],
      about: ["shared", "about-only"],
      contact: ["shared"],
    },
    onDiagnostics: (result) => {
      captured.push(result);
    },
  });

  const bundle: Record<string, unknown> = {
    "assets/all.css": asset(
      "assets/all.css",
      ".shared { color: red; } .about-only { color: blue; } .dead { display: none; }",
    ),
  };

  await hookFor(plugin).call(directContext(emitted), {}, bundle);

  const diagnostics = captured[0];
  assert.ok(diagnostics);
  assert.equal(diagnostics.splitApplied, true);
  assert.deepEqual(diagnostics.pages.sort(), ["about", "contact", "home"]);
  assert.equal(diagnostics.deadCodeCount, 1);
  assert.equal(diagnostics.emittedPageChunks.length, 1);
  assert.equal(diagnostics.emittedPageChunks[0]?.page, "about");
  assert.equal(diagnostics.emittedPageChunks[0]?.fileName, "page-about.css");

  const common = String(
    (bundle["assets/all.css"] as { source: unknown }).source,
  );
  assert.match(common, /\.shared/);
  assert.doesNotMatch(common, /\.dead/);
  assert.doesNotMatch(common, /\.about-only/);

  const aboutChunk = emitted.find((item) => item.fileName === "page-about.css");
  assert.ok(aboutChunk);
  assert.match(String(aboutChunk.source), /\.about-only/);

  const matrixSelector = diagnostics.usageMatrix.find(
    (stat) => stat.selector === ".about-only",
  );
  assert.ok(matrixSelector);
  assert.equal(matrixSelector.targetChunk, "page:about");
  assert.equal(matrixSelector.pageCount, 1);
  assert.ok(Math.abs(matrixSelector.coverageRatio - 0.3333) < 0.0001);
});

test("respects include/exclude filters", async () => {
  const captured: CssDoctorDiagnostics[] = [];
  const emitted: EmittedAsset[] = [];
  const plugin = cssDoctor({
    report: false,
    exclude: [/all\.css$/],
    onDiagnostics: (result) => {
      captured.push(result);
    },
  });

  await hookFor(plugin).call(
    directContext(emitted),
    {},
    {
      "assets/all.css": asset("assets/all.css", ".a { color: red; }"),
      "assets/keep.css": asset("assets/keep.css", ".b { color: blue; }"),
    },
  );

  const diagnostics = captured[0];
  assert.ok(diagnostics);
  assert.equal(diagnostics.totalCssAssets, 2);
  assert.equal(diagnostics.analyzedCssAssets, 1);
  assert.equal(diagnostics.skippedCssAssets, 1);
  assert.equal(diagnostics.files.length, 1);
  assert.equal(diagnostics.files[0]?.fileName, "assets/keep.css");
});

test("invalid CSS is reported without interrupting the build", async () => {
  const captured: CssDoctorDiagnostics[] = [];
  const plugin = cssDoctor({
    report: false,
    pageUsage: { home: ["app"] },
    onDiagnostics: (result) => {
      captured.push(result);
    },
  });

  await assert.doesNotReject(
    hookFor(plugin).call(
      directContext([]),
      {},
      {
        "bad.css": asset("bad.css", ".broken { color red; }"),
      },
    ),
  );

  const diagnostics = captured[0];
  assert.ok(diagnostics);
  assert.equal(diagnostics.failedCssAssets, 0);
  assert.ok(
    diagnostics.files[0]?.warnings.some((warning) => warning.kind === "syntax"),
  );
});

test("a throwing onDiagnostics callback is contained", async () => {
  const warnings: string[] = [];
  const plugin = cssDoctor({
    report: false,
    onDiagnostics: () => {
      throw new Error("callback boom");
    },
  });

  await assert.doesNotReject(
    hookFor(plugin).call(
      directContext([], warnings),
      {},
      {
        "a.css": asset("a.css", ".a { color: red; }"),
      },
    ),
  );

  assert.ok(warnings.some((warning) => warning.includes("onDiagnostics")));
});

test("prints the usage matrix and dead-code report", async () => {
  const lines: string[] = [];
  const originalLog = console.log;

  console.log = ((...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  }) as typeof console.log;

  try {
    const plugin = cssDoctor({
      report: true,
      pageUsage: {
        home: ["shared"],
        about: ["shared", "about-only"],
        contact: ["shared"],
      },
    });

    await hookFor(plugin).call(
      directContext([]),
      {},
      {
        "assets/all.css": asset(
          "assets/all.css",
          ".shared { color: red; } .about-only { color: blue; } .dead { display: none; }",
        ),
      },
    );
  } finally {
    console.log = originalLog;
  }

  const output = lines.join("\n");
  assert.match(output, /\[css-doctor\]/);
  assert.match(output, /Usage Matrix/);
  assert.match(output, /Assigned Chunk/);
  assert.match(output, /page-about\.css/);
  assert.match(output, /Dead code eliminated/);
});

test("rejects an invalid minPageRatio", () => {
  assert.throws(() => cssDoctor({ minPageRatio: 1.5 }), /minPageRatio/);
});

test("treats direct dynamic route imports as pages", async () => {
  const captured: CssDoctorDiagnostics[] = [];
  const spaRoot = join(packageRoot, "test/fixtures/spa");

  await build({
    root: spaRoot,
    logLevel: "silent",
    plugins: [
      cssDoctor({
        report: false,
        minPageRatio: 0.75,
        onDiagnostics: (result) => {
          captured.push(result);
        },
      }),
    ],
    build: {
      write: false,
    },
  });

  const diagnostics = captured[0];
  assert.ok(diagnostics);
  assert.deepEqual(diagnostics.pages.slice().sort(), ["about", "home"]);
  assert.equal(diagnostics.splitApplied, true);
  assert.equal(diagnostics.deadCodeCount, 1);
  assert.equal(diagnostics.emittedPageChunks.length, 2);
  assert.ok(
    diagnostics.emittedPageChunks.some((chunk) => chunk.page === "home"),
  );
  assert.ok(
    diagnostics.emittedPageChunks.some((chunk) => chunk.page === "about"),
  );

  const shared = diagnostics.usageMatrix.find(
    (stat) => stat.selector === ".shared-card",
  );
  assert.ok(shared);
  assert.equal(shared.pageCount, 2);
  assert.equal(shared.targetChunk, "common");

  const homeOnly = diagnostics.usageMatrix.find(
    (stat) => stat.selector === ".home-only",
  );
  assert.ok(homeOnly);
  assert.equal(homeOnly.pageCount, 1);
  assert.equal(homeOnly.targetChunk, "page:home");

  const dead = diagnostics.usageMatrix.find(
    (stat) => stat.selector === ".dead-route",
  );
  assert.ok(dead);
  assert.equal(dead.pageCount, 0);
  assert.equal(dead.targetChunk, "dead");
});
