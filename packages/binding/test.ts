import assert from "node:assert/strict";

type BindingModule = typeof import("./index.js");

const binding = require("./index.js") as BindingModule;

async function main(): Promise<void> {
  assert.equal(binding.JsSelectorKind.Class, "class");
  assert.equal(binding.JsSelectorKind.PseudoElement, "pseudo_element");

  const sampleCss = `
#app .card:hover {
  color: red;
}

@media (min-width: 768px) {
  .card--wide, .btn:focus-visible {
    width: 100%;
  }
}

@layer utilities {
  .hidden {
    display: none !important;
  }
}
`;

  const result = binding.analyzeCss(sampleCss);

  console.log("--- analyzeCss result ---");
  console.log(JSON.stringify(result, null, 2));

  assert.equal(result.selectors.length, 4);
  assert.deepEqual(
    result.selectors.map((selector) => selector.raw),
    ["#app .card:hover", ".card--wide", ".btn:focus-visible", ".hidden"],
  );
  assert.deepEqual(result.selectors[0]?.kinds, ["id", "class", "pseudo_class"]);
  assert.deepEqual(result.selectors[0]?.specificity, {
    ids: 1,
    classes: 2,
    types: 0,
  });
  assert.equal(result.rules.length, 3);
  assert.equal(result.rules[0]?.parentRuleIndex, undefined);
  assert.equal(result.rules[1]?.selectorIndices.length, 2);
  assert.equal(result.rules[2]?.importantDeclarationCount, 1);
  assert.equal(result.stats.ruleCount, 3);
  assert.equal(result.stats.selectorCount, 4);
  assert.equal(result.stats.declarationCount, 2);
  assert.equal(result.stats.importantDeclarationCount, 1);
  assert.equal(result.stats.uniqueClassCount, 4);
  assert.equal(result.stats.uniqueIdCount, 1);
  assert.equal(result.stats.warningCount, 0);

  const asyncResult = await binding.analyzeCssAsync(sampleCss);
  assert.deepEqual(asyncResult, result);

  const jsonResult = JSON.parse(binding.analyzeCssJson(sampleCss));
  assert.deepEqual(jsonResult, result);

  const recovered = binding.analyzeCss(`
.broken {
  color red;
}
.healthy {
  color: green;
}
`);
  assert.equal(recovered.selectors.length, 2);
  assert.ok(recovered.warnings.length > 0);
  assert.ok((recovered.warnings[0]?.message.length ?? 0) > 0);

  assert.deepEqual(binding.analyzeCss("").selectors, []);

  const split = binding.splitCssByPages({
    cssContent:
      ".shared { color: red; } .about { color: blue; } .dead { display: none; }",
    pageUsage: {
      home: ["shared"],
      about: ["shared", "about"],
      contact: ["shared"],
    },
    config: {
      minPageRatio: 0.5,
      forceCommonSelectors: [],
    },
  });

  assert.match(split.commonCss, /\.shared/);
  assert.match(split.pageChunks.about ?? "", /\.about/);
  assert.equal(split.deadCodeCount, 1);
  const aboutStat = split.stats.find((stat) => stat.selector === ".about");
  assert.ok(aboutStat);
  assert.equal(aboutStat.pageCount, 1);
  assert.equal(aboutStat.targetChunk, "page:about");

  const pipeline = binding.optimizeCss({
    cssContent:
      ":root { --brand: red; } .shared { color: var(--brand); } .home { color: blue; } .dead { display: none; }",
    pageUsage: {
      home: ["shared", "home"],
      about: ["shared"],
      contact: ["shared"],
    },
    pageCoverage: {
      enabled: true,
      minPageRatio: 0.5,
      forceCommon: [],
    },
    sizeBudget: {
      enabled: true,
      maxChunkSize: 40,
      isolateVariables: true,
    },
  });

  assert.ok(pipeline.chunks.length > 1);
  assert.ok(pipeline.chunks.some((chunk) => chunk.variables));
  assert.ok(pipeline.chunks.some((chunk) => chunk.part !== undefined));
  assert.equal(pipeline.deadCodeCount, 1);
  assert.ok(pipeline.chunks.every((chunk) => !chunk.css.includes("\n")));

  console.log("\n✅ css-doctor NAPI binding OK");
  console.log(
    `   ${result.stats.ruleCount} rules, ${result.stats.selectorCount} selectors, ` +
      `${result.stats.warningCount} warnings`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
