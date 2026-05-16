import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { fetchLatestGrainReleaseTag } from "./lib/release-tag.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GRAIN_REPO_URL = "https://github.com/grain-lang/grain.git";

/**
 * @param {string | null | undefined} cliRef
 * @param {string | undefined} envRef
 */
export async function resolveGrainRefForClone(cliRef, envRef) {
  const fromCli = cliRef?.trim();
  const fromEnv = envRef?.trim();
  const explicit = fromCli || fromEnv;
  if (explicit) return explicit;
  try {
    const tag = await fetchLatestGrainReleaseTag();
    console.log(`Using latest Grain release: ${tag}`);
    return tag;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`Failed to resolve the latest Grain release tag (${msg}). Falling back to main.`);
    return "main";
  }
}

/** @param {string} dir */
async function existsDir(dir) {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

/** @param {string} stdlibDir @returns {AsyncGenerator<string>} */
async function* walkGrainStdlib(stdlibDir) {
  const entries = await readdir(stdlibDir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(stdlibDir, e.name);
    if (e.isDirectory()) yield* walkGrainStdlib(p);
    else if (e.isFile() && e.name.endsWith(".gr")) yield p;
  }
}

function parseArgs(argv) {
  let grainRoot = null;
  let grainRef = null;
  let help = false;
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") help = true;
    if (arg.startsWith("--grain-ref=")) grainRef = arg.slice("--grain-ref=".length);
  }
  return { grainRoot, grainRef, help };
}

function printHelp() {
  console.error(`Usage: node scripts/validate-stdlib.mjs [options]

Options:
  --grain-ref=REF     Git tag, branch, or commit SHA when cloning Grain
                      (default: latest GitHub release tag)
`);
}

/** @param {string} ref */
function isProbablyCommitSha(ref) {
  return /^[0-9a-f]{7,40}$/i.test(ref);
}

/**
 * @param {string} dest
 * @param {string} ref
 */
function cloneGrainAtRef(dest, ref) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(path.dirname(dest), { recursive: true });

  if (isProbablyCommitSha(ref)) {
    const init = spawnSync("git", ["init", dest], { stdio: "inherit" });
    if (init.status !== 0) process.exit(init.status ?? 1);
    const remote = spawnSync("git", ["-C", dest, "remote", "add", "origin", GRAIN_REPO_URL], {
      stdio: "inherit",
    });
    if (remote.status !== 0) process.exit(remote.status ?? 1);
    const fetch = spawnSync(
      "git",
      ["-C", dest, "fetch", "--depth", "1", "origin", ref],
      { stdio: "inherit" },
    );
    if (fetch.status !== 0) process.exit(fetch.status ?? 1);
    const co = spawnSync("git", ["-C", dest, "checkout", "FETCH_HEAD"], { stdio: "inherit" });
    if (co.status !== 0) process.exit(co.status ?? 1);
    return;
  }

  const clone = spawnSync(
    "git",
    ["clone", "--depth", "1", "--branch", ref, GRAIN_REPO_URL, dest],
    { stdio: "inherit" },
  );
  if (clone.status !== 0) process.exit(clone.status ?? 1);
}

function warnIgnoredGrainRef(reason) {
  const cli = process.argv.find((a) => a.startsWith("--grain-ref="));
  const env = process.env.GRAIN_REF?.trim();
  if (cli || env) {
    console.warn(
      `Note: GRAIN_REF / --grain-ref is ignored because ${reason}. Omit GRAIN_ROOT and ./grain to clone at a ref.`,
    );
  }
}

/**
 * @param {{ grainRootFlag: string | null, grainRefFlag: string | null }} opts
 * @returns {Promise<{ grainRoot: string, removeClone: (() => void) | null }>}
 */
async function ensureGrainRepo(opts) {
  const { grainRootFlag, grainRefFlag } = opts;
  const envRoot = process.env.GRAIN_ROOT?.trim();

  if (envRoot) {
    return { grainRoot: path.resolve(envRoot), removeClone: null };
  }
  if (grainRootFlag) {
    return { grainRoot: path.resolve(grainRootFlag), removeClone: null };
  }

  const ref = await resolveGrainRefForClone(grainRefFlag, process.env.GRAIN_REF);
  const cloneDir = mkdtempSync(path.join(tmpdir(), "grain-stdlib-"));
  console.error(`Cloning ${GRAIN_REPO_URL} @ ${ref} into ${cloneDir}`);
  cloneGrainAtRef(cloneDir, ref);
  return {
    grainRoot: cloneDir,
    removeClone: () => rmSync(cloneDir, { recursive: true, force: true }),
  };
}

async function main() {
  const { grainRoot: grainRootFlag, grainRef: grainRefFlag, help } = parseArgs(process.argv.slice(2));
  if (help) {
    printHelp();
    return;
  }
  const { grainRoot, removeClone } = await ensureGrainRepo({ grainRootFlag, grainRefFlag });
  try {
    const stdlibDir = path.join(grainRoot, "stdlib");
    if (!(await existsDir(stdlibDir))) {
      console.error(`No stdlib directory at ${stdlibDir}`);
      process.exit(1);
    }

    /** @type {string[]} */
    const paths = [];
    for await (const p of walkGrainStdlib(stdlibDir)) paths.push(p);
    paths.sort();

    if (paths.length === 0) {
      console.error(`No .gr files under ${stdlibDir}`);
      process.exit(1);
    }

    console.error(`Parsing ${paths.length} files under ${stdlibDir}`);

    const tmpDir = mkdtempSync(path.join(tmpdir(), "stdlib-parse-"));
    const pathsFile = path.join(tmpDir, "paths.txt");
    try {
      writeFileSync(pathsFile, `${paths.join("\n")}\n`, "utf8");
      const res = spawnSync(
        "npx",
        ["--no-install", "tree-sitter", "parse", "--paths", pathsFile, "-q"],
        { cwd: repoRoot, stdio: "inherit", env: process.env },
      );
      if (res.error) throw res.error;
      if (res.status !== 0) process.exit(res.status ?? 1);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }

    console.error(`OK — all ${paths.length} stdlib .gr files parsed without errors.`);
  } finally {
    removeClone?.();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
