import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { cloneGrain } from "./lib/clone-grain.mjs";
import { fetchLatestGrainReleaseTag } from "./lib/release-tag.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {{
 *   grainRef?: string;
 *   eventName?: string;
 *   inputGrainRef?: string;
 *   inputPreview?: string | boolean;
 *   fallbackMain?: boolean;
 * }} opts
 */
export async function resolveGrainRef(opts = {}) {
  const explicit = opts.grainRef?.trim();
  if (explicit) return explicit;

  if (opts.eventName === "workflow_dispatch") {
    const dispatchRef = opts.inputGrainRef?.trim();
    if (dispatchRef) return dispatchRef;
    if (opts.inputPreview === true || opts.inputPreview === "true") return "main";
  }

  try {
    return await fetchLatestGrainReleaseTag();
  } catch (err) {
    if (!opts.fallbackMain) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`Failed to resolve latest Grain release (${msg}); using main.`);
    return "main";
  }
}

/**
 * @param {{
 *   dest?: string;
 *   grainRef?: string;
 *   eventName?: string;
 *   inputGrainRef?: string;
 *   inputPreview?: string | boolean;
 *   fallbackMain?: boolean;
 * }} [opts]
 * @returns {Promise<{ ref: string; root: string }>}
 */
export async function cloneGrainRepo(opts = {}) {
  const root = opts.dest ?? path.join(repoRoot, "grain");
  const ref = await resolveGrainRef(opts);
  console.log(`Cloning @ ${ref} into ${root}`);
  cloneGrain(root, ref);
  return { ref, root };
}

/**
 * @param {{
 *   grainRef?: string;
 *   eventName?: string;
 *   inputGrainRef?: string;
 *   inputPreview?: string | boolean;
 *   fallbackMain?: boolean;
 * }} [opts]
 */
export function grainRefEnv(opts = {}) {
  return {
    grainRef: opts.grainRef ?? process.env.GRAIN_REF,
    eventName: opts.eventName ?? process.env.GITHUB_EVENT_NAME,
    inputGrainRef: opts.inputGrainRef ?? process.env.INPUT_GRAIN_REF,
    inputPreview: opts.inputPreview ?? process.env.INPUT_PREVIEW,
    fallbackMain: opts.fallbackMain ?? true,
  };
}