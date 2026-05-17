import process from "node:process";
import { graphql } from "@octokit/graphql";
import { GRAIN_REPO_NAME, GRAIN_REPO_OWNER } from "./grain-repo.mjs";

const LATEST_RELEASE_QUERY = `
  query($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      latestRelease {
        tagName
      }
    }
  }
`;

function graphqlClient() {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) return graphql;
  return graphql.defaults({
    headers: { authorization: `token ${token}` },
  });
}

export async function fetchLatestGrainReleaseTag() {
  const { repository } = await graphqlClient()(LATEST_RELEASE_QUERY, {
    owner: GRAIN_REPO_OWNER,
    name: GRAIN_REPO_NAME,
  });

  const tagName = repository?.latestRelease?.tagName;
  if (!tagName || typeof tagName !== "string") {
    throw new Error("Latest Grain release has no tag");
  }
  return tagName;
}
