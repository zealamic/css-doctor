import { execFile } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import { parse as parseToml } from "smol-toml";

const ROOT = resolve(process.cwd());
const INDEX_FILE = join(ROOT, "monitor/index.html");
const USER_AGENT = "css-doctor-monitor";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_BODY_BYTES = 1_000_000;
const execFileAsync = promisify(execFile);

type Ecosystem = "node" | "rust";
type DependencyType =
  | "dependencies"
  | "devDependencies"
  | "peerDependencies"
  | "dev-dependencies"
  | "build-dependencies";
type DependencyStatus = "up-to-date" | "outdated" | "error";

type ManifestDependency = {
  ecosystem: Ecosystem;
  subRepo: string;
  name: string;
  type: DependencyType;
  current: string;
  filePath: string;
  section: string;
  local: boolean;
};

type DependencyRow = Omit<ManifestDependency, "filePath" | "section"> & {
  latest: string | null;
  status: DependencyStatus;
  note?: string;
};

type UpgradePayload = {
  ecosystem?: unknown;
  subRepo?: unknown;
  package?: unknown;
  type?: unknown;
  latestVersion?: unknown;
};

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "examples",
  "node_modules",
  "target",
]);

type LatestCacheEntry = {
  expiresAt: number;
  promise: Promise<string | null>;
};

const LATEST_CACHE_TTL_MS = 5 * 60 * 1000;
const latestCache = new Map<string, LatestCacheEntry>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePath(path: string): string {
  return relative(ROOT, path).split(sep).join("/") || "root";
}

function assertInsideRoot(path: string): void {
  const resolved = resolve(path);

  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${sep}`)) {
    throw new Error("Path escapes the monorepo root");
  }
}

async function walkFiles(
  directory: string,
  fileName: string,
  found: string[],
): Promise<void> {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        await walkFiles(join(directory, entry.name), fileName, found);
      }
      continue;
    }

    if (entry.isFile() && entry.name === fileName) {
      found.push(join(directory, entry.name));
    }
  }
}

async function collectPackageFiles(): Promise<string[]> {
  const files = [join(ROOT, "package.json")];
  await walkFiles(join(ROOT, "packages"), "package.json", files);
  return files;
}

async function collectCargoFiles(): Promise<string[]> {
  const files = [join(ROOT, "Cargo.toml")];
  await walkFiles(join(ROOT, "crates"), "Cargo.toml", files);
  // packages/binding is a NAPI crate and a workspace member too.
  await walkFiles(join(ROOT, "packages"), "Cargo.toml", files);
  return files;
}

function nodeSubRepo(
  filePath: string,
  packageName: string | undefined,
): string {
  if (filePath === join(ROOT, "package.json")) {
    return "root";
  }

  return packageName ?? normalizePath(dirname(filePath));
}

function isLocalNodeSpecifier(version: string): boolean {
  return (
    version.startsWith("workspace:") ||
    version.startsWith("file:") ||
    version.startsWith("link:") ||
    version.startsWith("catalog:") ||
    version.startsWith("git+") ||
    version.startsWith("http://") ||
    version.startsWith("https://")
  );
}

async function scanNodeManifests(): Promise<ManifestDependency[]> {
  const dependencies: ManifestDependency[] = [];
  const files = await collectPackageFiles();
  const sections: Array<{
    key: "dependencies" | "devDependencies" | "peerDependencies";
    type: DependencyType;
  }> = [
    { key: "dependencies", type: "dependencies" },
    { key: "devDependencies", type: "devDependencies" },
    { key: "peerDependencies", type: "peerDependencies" },
  ];

  for (const filePath of files) {
    let manifest: unknown;

    try {
      manifest = JSON.parse(await readFile(filePath, "utf8"));
    } catch (error) {
      console.warn(`[monitor] skipping ${filePath}: ${errorMessage(error)}`);
      continue;
    }

    if (!isRecord(manifest)) {
      continue;
    }

    const packageName =
      typeof manifest.name === "string" ? manifest.name : undefined;
    const subRepo = nodeSubRepo(filePath, packageName);

    for (const section of sections) {
      const values = manifest[section.key];

      if (!isRecord(values)) {
        continue;
      }

      for (const [name, value] of Object.entries(values)) {
        if (typeof value !== "string") {
          continue;
        }

        dependencies.push({
          ecosystem: "node",
          subRepo,
          name,
          type: section.type,
          current: value,
          filePath,
          section: section.key,
          local: isLocalNodeSpecifier(value),
        });
      }
    }
  }

  return dependencies;
}

function isLocalCargoSpecifier(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.workspace === true ||
    typeof value.path === "string" ||
    typeof value.git === "string"
  );
}

function cargoCurrent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (isRecord(value) && typeof value.version === "string") {
    return value.version;
  }

  return "";
}

async function scanCargoManifests(): Promise<ManifestDependency[]> {
  const dependencies: ManifestDependency[] = [];
  const files = await collectCargoFiles();
  const sections: Array<{ key: string; type: DependencyType }> = [
    { key: "dependencies", type: "dependencies" },
    { key: "dev-dependencies", type: "dev-dependencies" },
    { key: "build-dependencies", type: "build-dependencies" },
    { key: "workspace.dependencies", type: "dependencies" },
  ];

  for (const filePath of files) {
    let parsed: unknown;

    try {
      parsed = parseToml(await readFile(filePath, "utf8"));
    } catch (error) {
      console.warn(`[monitor] skipping ${filePath}: ${errorMessage(error)}`);
      continue;
    }

    if (!isRecord(parsed)) {
      continue;
    }

    const subRepo = normalizePath(dirname(filePath));

    for (const section of sections) {
      const table = section.key
        .split(".")
        .reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), parsed);

      if (!isRecord(table)) {
        continue;
      }

      for (const [name, value] of Object.entries(table)) {
        if (typeof value !== "string" && !isRecord(value)) {
          continue;
        }

        const local = isLocalCargoSpecifier(value);
        dependencies.push({
          ecosystem: "rust",
          subRepo,
          name,
          type: section.type,
          current: cargoCurrent(value),
          filePath,
          section: section.key,
          local,
        });
      }
    }
  }

  return dependencies;
}

async function fetchLatest(
  ecosystem: Ecosystem,
  name: string,
): Promise<string | null> {
  const cacheKey = `${ecosystem}:${name}`;
  const cached = latestCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.promise;
  }

  const promise = fetchLatestUncached(ecosystem, name);
  latestCache.set(cacheKey, {
    expiresAt: Date.now() + LATEST_CACHE_TTL_MS,
    promise,
  });
  return promise;
}

async function fetchLatestUncached(
  ecosystem: Ecosystem,
  name: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url =
    ecosystem === "node"
      ? `https://registry.npmjs.org/${encodeURIComponent(name)}/latest`
      : `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`registry returned ${response.status}`);
    }

    const body = (await response.json()) as unknown;

    if (ecosystem === "node") {
      return isRecord(body) && typeof body.version === "string"
        ? body.version
        : null;
    }

    if (!isRecord(body) || !isRecord(body.crate)) {
      return null;
    }

    return (
      (typeof body.crate.max_stable_version === "string" &&
        body.crate.max_stable_version) ||
      (typeof body.crate.max_version === "string" &&
        body.crate.max_version) ||
      null
    );
  } catch (error) {
    const message = errorMessage(error);
    console.warn(`[monitor] ${ecosystem} ${name}: ${message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeVersion(value: string): string {
  return value
    .trim()
    .replace(/^(?:workspace:|npm:)/, "")
    .replace(/^[~^<>=v]+/, "")
    .trim();
}

function dependencyStatus(
  current: string,
  latest: string | null,
  local: boolean,
): DependencyStatus {
  if (local) {
    return "up-to-date";
  }

  if (!latest) {
    return "error";
  }

  return normalizeVersion(current) === normalizeVersion(latest)
    ? "up-to-date"
    : "outdated";
}

async function enrichDependencies(
  manifests: ManifestDependency[],
): Promise<DependencyRow[]> {
  const queue = [...manifests];
  const rows: DependencyRow[] = [];
  const concurrency = 8;

  async function worker(): Promise<void> {
    for (;;) {
      const dependency = queue.shift();

      if (!dependency) {
        return;
      }

      const latest = dependency.local
        ? null
        : await fetchLatest(dependency.ecosystem, dependency.name);
      const status = dependencyStatus(
        dependency.current,
        latest,
        dependency.local,
      );

      rows.push({
        ecosystem: dependency.ecosystem,
        subRepo: dependency.subRepo,
        name: dependency.name,
        type: dependency.type,
        current: dependency.current || (dependency.local ? "local" : ""),
        latest,
        status,
        local: dependency.local,
        note: dependency.local ? "Local workspace/path dependency" : undefined,
      });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, manifests.length) }, () =>
      worker(),
    ),
  );

  return rows;
}

async function scanDependencies(): Promise<DependencyRow[]> {
  const [nodeDependencies, rustDependencies] = await Promise.all([
    scanNodeManifests(),
    scanCargoManifests(),
  ]);

  return enrichDependencies([...nodeDependencies, ...rustDependencies]);
}

function findManifestDependency(
  manifests: ManifestDependency[],
  payload: UpgradePayload,
): ManifestDependency | undefined {
  const ecosystem = payload.ecosystem;
  const subRepo = payload.subRepo;
  const packageName = payload.package;
  const type = payload.type;

  if (ecosystem !== "node" && ecosystem !== "rust") {
    return undefined;
  }

  const matches = manifests.filter(
    (dependency) =>
      dependency.ecosystem === ecosystem &&
      dependency.subRepo === subRepo &&
      dependency.name === packageName &&
      (type === undefined || dependency.type === type),
  );

  if (matches.length > 1) {
    throw new Error(
      "Upgrade is ambiguous; include the dependency type in the request",
    );
  }

  return matches[0];
}

function validateLatestVersion(value: string): boolean {
  return /^[0-9A-Za-z][0-9A-Za-z0-9.+-]*$/.test(value);
}

function nextNodeRange(current: string, latest: string): string {
  if (current.startsWith("^")) {
    return `^${latest}`;
  }

  if (current.startsWith("~")) {
    return `~${latest}`;
  }

  const comparison = current.match(/^(>=|<=|>|<|=)/);

  if (comparison) {
    return `${comparison[1]}${latest}`;
  }

  if (current === "*" || current === "latest") {
    return `^${latest}`;
  }

  return latest;
}

async function updateNodeDependency(
  dependency: ManifestDependency,
  latest: string,
): Promise<string> {
  assertInsideRoot(dependency.filePath);

  const manifest = JSON.parse(
    await readFile(dependency.filePath, "utf8"),
  ) as Record<string, unknown>;
  const section = manifest[dependency.section];

  if (!isRecord(section)) {
    throw new Error(`Section ${dependency.section} not found`);
  }

  const current = section[dependency.name];

  if (typeof current !== "string") {
    throw new Error("Dependency is not a string version");
  }

  if (isLocalNodeSpecifier(current)) {
    throw new Error("Local/workspace dependencies cannot be upgraded");
  }

  section[dependency.name] = nextNodeRange(current, latest);
  await writeFile(
    dependency.filePath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return `Updated ${dependency.name} to ${latest}. Run pnpm install to refresh the lockfile.`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function updateCargoDependency(
  dependency: ManifestDependency,
  latest: string,
): Promise<string> {
  assertInsideRoot(dependency.filePath);

  const source = await readFile(dependency.filePath, "utf8");
  const lines = source.split(/\r?\n/);
  const header = `[${dependency.section}]`;
  const keyPattern = new RegExp(
    `^(\\s*)${escapeRegExp(dependency.name)}\\s*=\\s*(.*)$`,
  );
  let inSection = false;
  let changed = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      inSection = trimmed === header;
      continue;
    }

    if (!inSection) {
      continue;
    }

    const match = line.match(keyPattern);

    if (!match) {
      continue;
    }

    const prefix = match[1] ?? "";
    const rest = match[2] ?? "";

    if (/^\s*["']/.test(rest)) {
      lines[index] = `${prefix}${dependency.name} = "${latest}"`;
      changed = true;
      break;
    }

    const versionMatch = rest.match(/version\s*=\s*["'][^"']*["']/);

    if (versionMatch) {
      lines[index] = line.replace(
        versionMatch[0],
        `version = "${latest}"`,
      );
      changed = true;
      break;
    }

    throw new Error(
      `${dependency.name} uses a workspace/path/git dependency and cannot be upgraded here`,
    );
  }

  if (!changed) {
    throw new Error(`Could not locate ${dependency.name} in ${header}`);
  }

  await writeFile(dependency.filePath, lines.join("\n"), "utf8");

  return `Updated ${dependency.name} to ${latest}.`;
}

async function upgradeDependency(
  payload: UpgradePayload,
): Promise<{ message: string; output?: string }> {
  const latestVersion = payload.latestVersion;

  if (typeof latestVersion !== "string" || !validateLatestVersion(latestVersion)) {
    throw new Error("Invalid latestVersion");
  }

  const manifests = [...(await scanNodeManifests()), ...(await scanCargoManifests())];
  const dependency = findManifestDependency(manifests, payload);

  if (!dependency) {
    throw new Error("Dependency not found in scanned manifests");
  }

  if (dependency.local) {
    throw new Error("Local/workspace dependencies cannot be upgraded");
  }

  if (dependency.ecosystem === "node") {
    const message = await updateNodeDependency(dependency, latestVersion);
    let output = "";

    try {
      const result = await execFileAsync(
        "pnpm",
        ["install", "--lockfile-only", "--ignore-scripts"],
        {
          cwd: ROOT,
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    } catch (error) {
      output = `package.json updated, but pnpm install failed: ${errorMessage(
        error,
      )}`;
    }

    return { message, output };
  }

  const message = await updateCargoDependency(dependency, latestVersion);
  let output = "";

  try {
    const result = await execFileAsync(
      "cargo",
      ["update", "-p", dependency.name, "--precise", latestVersion],
      {
        cwd: ROOT,
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  } catch (error) {
    output = `Cargo.toml updated, but cargo update failed: ${errorMessage(
      error,
    )}`;
  }

  return { message, output };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sendJson(
  response: ServerResponse,
  status: number,
  value: unknown,
): void {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

async function readJsonBody(request: IncomingMessage): Promise<UpgradePayload> {
  let size = 0;
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;

    if (size > MAX_BODY_BYTES) {
      throw new Error("Request body is too large");
    }

    chunks.push(buffer);
  }

  const body = Buffer.concat(chunks).toString("utf8").trim();

  if (!body) {
    throw new Error("Request body is empty");
  }

  const parsed = JSON.parse(body) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("Request body must be a JSON object");
  }

  return parsed as UpgradePayload;
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    try {
      const html = await readFile(INDEX_FILE);
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(html);
    } catch (error) {
      sendJson(response, 500, { error: errorMessage(error) });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/deps") {
    try {
      if (url.searchParams.get("refresh") === "1") {
        latestCache.clear();
      }

      const dependencies = await scanDependencies();
      sendJson(response, 200, {
        generatedAt: new Date().toISOString(),
        dependencies,
      });
    } catch (error) {
      sendJson(response, 500, { error: errorMessage(error) });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/upgrade") {
    try {
      const payload = await readJsonBody(request);
      const result = await upgradeDependency(payload);
      sendJson(response, 200, { ok: true, ...result });
    } catch (error) {
      sendJson(response, 400, { ok: false, error: errorMessage(error) });
    }
    return;
  }

  if (url.pathname === "/favicon.ico") {
    response.writeHead(204);
    response.end();
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

function openBrowser(url: string): void {
  if (process.env.MONITOR_NO_OPEN === "1") {
    return;
  }

  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args =
    process.platform === "win32" ? ["/c", "start", "", url] : [url];

  execFile(command, args, (error) => {
    if (error) {
      console.warn(`[monitor] could not open browser: ${error.message}`);
    }
  });
}

async function start(): Promise<void> {
  const server = createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      sendJson(response, 500, { error: errorMessage(error) });
    });
  });

  let port = 3000;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await new Promise<void>((resolveListen, rejectListen) => {
        const onError = (error: NodeJS.ErrnoException): void => {
          server.off("listening", onListening);
          rejectListen(error);
        };
        const onListening = (): void => {
          server.off("error", onError);
          resolveListen();
        };

        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, "127.0.0.1");
      });

      const address = server.address();
      const actualPort =
        typeof address === "object" && address ? address.port : port;
      const url = `http://127.0.0.1:${actualPort}`;

      console.log(`[monitor] css-doctor dependency monitor: ${url}`);
      console.log("[monitor] scanning manifests; latest versions are cached for 5 minutes");
      openBrowser(url);
      return;
    } catch (error) {
      const code = isRecord(error) && typeof error.code === "string" ? error.code : "";

      if (code !== "EADDRINUSE") {
        throw error;
      }

      port += 1;
    }
  }

  throw new Error("No free port found in range 3000-3019");
}

process.on("SIGINT", () => {
  process.exit(0);
});

start().catch((error) => {
  console.error(`[monitor] failed to start: ${errorMessage(error)}`);
  process.exit(1);
});
