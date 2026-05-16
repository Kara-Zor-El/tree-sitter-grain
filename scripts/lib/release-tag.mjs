const GRAIN_RELEASES_URL =
  "https://api.github.com/repos/grain-lang/grain/releases/latest";

export async function fetchLatestGrainReleaseTag() {
  const res = await fetch(GRAIN_RELEASES_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch the latest Grain release tag: ${res.status} ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  if (!data.tag_name || typeof data.tag_name !== "string") {
    throw new Error("Failed to fetch the latest Grain release tag");
  }
  return data.tag_name;
}