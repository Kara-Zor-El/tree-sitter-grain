import { appendFile } from "node:fs/promises";
import process from "node:process";
import { fetchLatestGrainReleaseTag } from "./lib/release-tag.mjs";

/**
* @param {{
*   eventName?: string;
*   inputGrainRef?: string;
*   inputPreview?: string | boolean;
* }} opts
*/
export async function resolveGrainRefForCI(opts) {
 const { eventName, inputGrainRef, inputPreview } = opts;
 let ref = "";

 if (eventName === "workflow_dispatch") {
   const explicit = inputGrainRef?.trim();
   if (explicit) ref = explicit;
   else if (inputPreview === true || inputPreview === "true") ref = "main";
 }

 if (!ref) ref = await fetchLatestGrainReleaseTag();
 if (!ref) throw new Error("Failed to resolve a Grain git ref");
 return ref;
}

async function main() {
  const ref = await resolveGrainRefForCI({
    eventName: process.env.GITHUB_EVENT_NAME ?? process.env.EVENT_NAME,
    inputGrainRef: process.env.INPUT_GRAIN_REF,
    inputPreview: process.env.INPUT_PREVIEW,
  });

  console.log(`Resolved Grain ref: ${ref}`);

  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    await appendFile(outputFile, `grain_ref=${ref}\n`);
    return;
  }

  process.stdout.write(`${ref}\n`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
