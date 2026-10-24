import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";
import webpack from "webpack";
import type { Compiler, Configuration, Stats } from "webpack";

import { findCssDoctorConfig, loadCssDoctorConfig } from "../src/config";
import { withCssDoctor } from "../src/index";
import { formatDiagnostics } from "../src/reporter";
import type {
  CssDoctorNextDiagnostics,
  CssDoctorWebpackPluginOptions,
} from "../src/types";
import { CssDoctorWebpackPlugin } from "../src/webpack-plugin";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const entryPath = join(packageRoot, "test/fixtures/webpack-entry.js");
const configProject = join(packageRoot, "test/fixtures/config-project");

class CssFixturePlugin {
  constructor(private readonly css: string) {}

  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap("CssFixturePlugin", (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: "CssFixturePlugin",
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        () => {
          compilation.emitAsset(
            "static/css/app.css",
            new compiler.webpack.sources.RawSource(this.css),
          );
        },
      );
    });
  }
}

async function runWebpack(
  css: string,
  options: CssDoctorWebpackPluginOptions,
): Promise<{
  stats: Stats;
  diagnostics: CssDoctorNextDiagnostics;
  assets: Map<string, string>;
}> {
  const outputPath = await mkdtemp(join(tmpdir(), "cssd-next-"));
  const captured: CssDoctorNextDiagnostics[] = [];

  const config: Configuration = {
    mode: "development",
    entry: entryPath,
    output: {
      path: outputPath,
      filename: "[name].js",
      clean: true,
    },
    optimization: {
      minimize: false,
    },
    plugins: [
      new CssFixturePlugin(css),
      new CssDoctorWebpackPlugin({
        report: false,
        ...options,
        onDiagnostics: (diagnostics) => {
          captured.push(diagnostics);
        },
      }),
    ],
    stats: "errors-warnings",
  };

  const stats = await new Promise<Stats>((resolve, reject) => {
    const compiler = webpack(config);

    compiler.run((error, result) => {
      compiler.close(() => undefined);

      if (error) {
        reject(error);
      } else if (!result) {
        reject(new Error("webpack returned no stats"));
      } else {
        resolve(result);
      }
    });
  });

  const diagnostics = captured[0];
  assert.ok(diagnostics, "onDiagnostics should be called");

  const assets = new Map<string, string>();
  const cssAssetNames = [
    "static/css/app.css",
    ...diagnostics.emittedPageChunks.map((chunk) => chunk.fileName),
  ];

  for (const fileName of cssAssetNames) {
    assets.set(fileName, await readFile(join(outputPath, fileName), "utf8"));
  }

  await rm(outputPath, { recursive: true, force: true });

  return { stats, diagnostics, assets };
}

test("loads cssd.config.ts from the project root", () => {
  assert.equal(
    findCssDoctorConfig(configProject),
    join(configProject, "cssd.config.ts"),
  );

  const loaded = loadCssDoctorConfig({ cwd: configProject });

  assert.equal(loaded.error, undefined);
  assert.equal(loaded.file, join(configProject, "cssd.config.ts"));
  assert.equal(loaded.options.minPageRatio, 0.25);
  assert.equal(loaded.options.report, false);
  assert.deepEqual(loaded.options.forceCommonSelectors, [".always-keep"]);
  assert.deepEqual(loaded.options.pageUsage, {
    home: ["shared", "always-keep"],
    about: ["shared", "about-only"],
  });
});

test("withCssDoctor preserves user webpack config and only adds the plugin to client production", async () => {
  let calls = 0;
  const baseConfig: NextConfig = {
    webpack: (config) => {
      calls += 1;
      return {
        ...config,
        fromUserConfig: true,
      };
    },
  };

  const wrapped = withCssDoctor(baseConfig, {
    report: false,
    pageUsage: { home: ["app"] },
  });
  const hook = wrapped.webpack;

  assert.ok(hook);

  const configFor = (context: { dev: boolean; isServer: boolean }) => {
    const config = { plugins: [] as unknown[] };
    const result = hook(config, context as never);
    return result as {
      plugins: unknown[];
      fromUserConfig?: boolean;
    };
  };

  const devConfig = configFor({ dev: true, isServer: false });
  assert.equal(
    devConfig.plugins.some(
      (plugin) => plugin instanceof CssDoctorWebpackPlugin,
    ),
    false,
  );

  const serverConfig = configFor({ dev: false, isServer: true });
  assert.equal(
    serverConfig.plugins.some(
      (plugin) => plugin instanceof CssDoctorWebpackPlugin,
    ),
    false,
  );

  const clientConfig = configFor({ dev: false, isServer: false });
  assert.equal(clientConfig.fromUserConfig, true);
  assert.equal(
    clientConfig.plugins.some(
      (plugin) => plugin instanceof CssDoctorWebpackPlugin,
    ),
    true,
  );
  assert.equal(calls, 3);

  const asyncWrapped = withCssDoctor(
    {
      webpack: async (config) => ({
        ...config,
        asyncConfig: true,
      }),
    },
    { report: false, pageUsage: { home: ["app"] } },
  );
  const asyncHook = asyncWrapped.webpack;
  assert.ok(asyncHook);

  const asyncResult = (await asyncHook({ plugins: [] }, {
    dev: false,
    isServer: false,
  } as never)) as {
    plugins: unknown[];
    asyncConfig?: boolean;
  };

  assert.equal(asyncResult.asyncConfig, true);
  assert.equal(
    asyncResult.plugins.some(
      (plugin) => plugin instanceof CssDoctorWebpackPlugin,
    ),
    true,
  );
});

test("splits CSS assets inside a real webpack compilation", async () => {
  const { stats, diagnostics, assets } = await runWebpack(
    ".shared { color: red; } .about-only { color: blue; } .dead { display: none; }",
    {
      minPageRatio: 0.5,
      pageUsage: {
        home: ["shared"],
        about: ["shared", "about-only"],
        contact: ["shared"],
      },
    },
  );

  assert.equal(stats.hasErrors(), false);
  assert.equal(diagnostics.plugin, "css-doctor-next");
  assert.equal(diagnostics.pages.length, 3);
  assert.equal(diagnostics.splitApplied, true);
  assert.equal(diagnostics.totalCssAssets, 1);
  assert.equal(diagnostics.analyzedCssAssets, 1);
  assert.equal(diagnostics.deadCodeCount, 1);
  assert.equal(diagnostics.emittedPageChunks.length, 1);
  assert.equal(
    diagnostics.emittedPageChunks[0]?.fileName,
    "static/css/page-about.css",
  );

  const commonCss = assets.get("static/css/app.css");
  const pageCss = assets.get("static/css/page-about.css");

  assert.ok(commonCss);
  assert.ok(pageCss);

  assert.match(commonCss, /\.shared/);
  assert.doesNotMatch(commonCss, /\.about-only/);
  assert.doesNotMatch(commonCss, /\.dead/);
  assert.match(pageCss, /\.about-only/);

  const aboutStat = diagnostics.usageMatrix.find(
    (stat) => stat.selector === ".about-only",
  );
  assert.ok(aboutStat);
  assert.equal(aboutStat.targetChunk, "page:about");
  assert.equal(aboutStat.pageCount, 1);

  const report = formatDiagnostics(diagnostics, { color: false });
  assert.match(report, /\[css-doctor\]/);
  assert.match(report, /Usage Matrix/);
  assert.match(report, /Assigned Chunk/);
  assert.match(report, /page-about\.css/);
  assert.match(report, /Dead code eliminated/);
});

test("webpack build survives invalid CSS and a throwing callback", async () => {
  const outputPath = await mkdtemp(join(tmpdir(), "cssd-next-safe-"));

  const config: Configuration = {
    mode: "development",
    entry: entryPath,
    output: {
      path: outputPath,
      filename: "[name].js",
      clean: true,
    },
    plugins: [
      new CssFixturePlugin(".broken { color red; }"),
      new CssDoctorWebpackPlugin({
        report: false,
        pageUsage: { home: ["app"] },
        onDiagnostics: () => {
          throw new Error("callback boom");
        },
      }),
    ],
    stats: "errors-warnings",
  };

  const stats = await new Promise<Stats>((resolve, reject) => {
    const compiler = webpack(config);

    compiler.run((error, result) => {
      compiler.close(() => undefined);

      if (error) {
        reject(error);
      } else if (!result) {
        reject(new Error("webpack returned no stats"));
      } else {
        resolve(result);
      }
    });
  });

  await rm(outputPath, { recursive: true, force: true });

  assert.equal(stats.hasErrors(), false);
});
