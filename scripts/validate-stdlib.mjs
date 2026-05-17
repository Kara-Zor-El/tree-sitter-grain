import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import process from "node:process";
import { cloneGrainRepo, grainRefEnv } from "./grain-ref.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @param {string} stdlibDir @returns {AsyncGenerator<string>} */
async function* walkGrainStdlib(stdlibDir) {
  const entries = await readdir(stdlibDir, { withFileTypes: true, recursive: true });
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith(".gr")) yield path.join(e.parentPath, e.name);
  }
}

function printHelp() {
  console.error(`Usage: node scripts/validate-stdlib.mjs [options]

Options:
  -h, --help            Show this help
  --grain-ref <REF>     Clone Grain at this ref (overrides GRAIN_ROOT and GRAIN_REF)
  GRAIN_REF             Git ref when cloning (default: latest release, or CI dispatch inputs)
  GRAIN_ROOT            Use an existing Grain checkout instead of cloning
`);
}

/**
 * @param {{ grainRefFlag: string | undefined }} opts
 * @returns {Promise<string>}
 */
async function ensureGrainRepo(opts) {
  const { grainRefFlag } = opts;
  const envRoot = process.env.GRAIN_ROOT?.trim();

  if (grainRefFlag) {
    if (envRoot) {
      console.warn(
        "Note: GRAIN_ROOT is ignored because --grain-ref is set. Unset GRAIN_ROOT or omit --grain-ref.",
      );
    }
    return (await cloneGrainRepo({ ...grainRefEnv(), grainRef: grainRefFlag })).root;
  }

  if (envRoot) return path.resolve(envRoot);

  return (await cloneGrainRepo(grainRefEnv())).root;
}

try {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: "boolean", short: "h", default: false },
      "grain-ref": { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });
  const grainRefFlag = values["grain-ref"];
  if (values.help) {
    printHelp();
  } else {
    const grainRoot = await ensureGrainRepo({ grainRefFlag });
    const stdlibDir = path.join(grainRoot, "stdlib");
    if (!existsSync(stdlibDir)) {
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
  }
} catch (err) {
  console.error(err);
  process.exit(1);
}
