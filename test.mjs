import { exec } from "node:child_process";
import { parseArgs } from "node:util";
import { styleText } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import test from "node:test";
import assert from "node:assert";

import Parser from "tree-sitter";
import Grain from "./bindings/node/index.js";

// Standard configuration
const GRAIN_REPO_OWNER = "grain-lang";
const GRAIN_REPO_NAME = "grain";
const GRAIN_REPO_URL = `https://github.com/${GRAIN_REPO_OWNER}/${GRAIN_REPO_NAME}.git`;

// Setup the parser
const parser = new Parser();
parser.setLanguage(Grain);

// Helpers
async function* getGrainFiles(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* getGrainFiles(full);
    else if (entry.isFile() && full.endsWith(".gr")) yield full;
  }
}
const runGit = (args) => {
  return new Promise((resolve, reject) => {
    exec(`git ${args.join(" ")}`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
};
const hasTreeSitterParsingErrors = (source) =>
  parser.parse(source).rootNode.hasError;
const error = (msg) => console.error(styleText(["red", "bold"], "Error:"), msg);
const info = (msg) => console.log(styleText(["blue", "bold"], "Info:"), msg);

// Parse out the command line options
const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    commit: {
      type: "string",
      default: "main",
    },
    debug: {
      type: "boolean",
      default: false,
    },
  },
});

// Clone the grain repo
info(`Cloning \`${GRAIN_REPO_URL}\` repo at \`${values.commit}\``);
await fs.rm("./grain", { recursive: true, force: true });
await runGit(["clone", GRAIN_REPO_URL]).catch((e) => {
  error(`Failed to clone grain repo from \`${GRAIN_REPO_URL}\``);
  error(
    "Please make sure you have access to the repo and that the URL is correct.",
  );
  error("`--debug` can be used to get more information about the error.");
  if (values.debug) throw new Error(`Failed to clone grain repo: ${e.message}`);
  process.exit(1);
});
await runGit(["-C", "grain", "checkout", values.commit]).catch((e) => {
  error(`Failed to checkout commit \`${values.commit}\``);
  error("Please make sure the commit exists and is accessible.");
  error(
    "If you are trying to test against the latest preview use `--commit=main`.",
  );
  error(
    "If you are trying to test against a specific version use `--commit=grain-vX.Y.Z`.",
  );
  error(
    "If you are trying to test against a specific commit use `--commit=COMMIT_HASH`.",
  );
  error("`--debug` can be used to get more information about the error.");
  if (values.debug) throw new Error(`Failed to clone grain repo: ${e.message}`);
  process.exit(1);
});

// Run the test suite
test("Stdlib", async (t) => {
  for await (const file of getGrainFiles("./grain/stdlib")) {
    await t.test(`Testing \`${file}\``, async () => {
      const source = await fs.readFile(file, "utf8");
      assert.ok(
        !hasTreeSitterParsingErrors(source),
        `Tree-sitter failed to parse \`${file}\`, for more information investigate the error using the tree-sitter CLI.`,
      );
    });
  }
});
