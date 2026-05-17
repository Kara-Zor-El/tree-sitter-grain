import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { GRAIN_REPO_URL } from "./grain-repo.mjs";

/** @param {string[]} args */
function runGit(args) {
  const res = spawnSync("git", args, { stdio: "inherit" });
  if (res.error) throw res.error;
  if (res.status !== 0) process.exit(res.status ?? 1);
}

/**
 * @param {string} dest
 * @param {string} ref
 */
export function cloneGrain(dest, ref) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(path.dirname(dest), { recursive: true });

  runGit(["init", dest]);
  runGit(["-C", dest, "remote", "add", "origin", GRAIN_REPO_URL]);
  runGit(["-C", dest, "fetch", "--depth", "1", "origin", ref]);
  runGit(["-C", dest, "checkout", "FETCH_HEAD"]);
}
