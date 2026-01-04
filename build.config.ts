/**
 * Build Configuration for OpenCode
 *
 * This file centralizes all fork-specific configuration that gets processed at build time.
 * Fork maintainers can either:
 * 1. Modify the defaults in this file directly
 * 2. Override via environment variables at build time
 *
 * Example:
 *   OPENCODE_GITHUB_OWNER=myuser OPENCODE_GITHUB_REPO=myfork bun run build
 */

const github = {
  owner: Bun.env.OPENCODE_GITHUB_OWNER ?? "hk9890",
  repo: Bun.env.OPENCODE_GITHUB_REPO ?? "opencode",
  branch: Bun.env.OPENCODE_GITHUB_BRANCH ?? "dev-hako",
}

const githubRepo = `${github.owner}/${github.repo}`

const urls = {
  releases: `https://github.com/${githubRepo}/releases`,
  releasesLatest: `https://github.com/${githubRepo}/releases/latest`,
  releasesApi: `https://api.github.com/repos/${githubRepo}/releases/latest`,
  install: `https://raw.githubusercontent.com/${githubRepo}/refs/heads/${github.branch}/install`,
  updaterEndpoint: `https://github.com/${githubRepo}/releases/latest/download/latest.json`,
  issues: `https://github.com/${githubRepo}/issues`,
  newIssue: `https://github.com/${githubRepo}/issues/new`,
  newBugReport: `https://github.com/${githubRepo}/issues/new?template=bug-report.yml`,
}

const docker = {
  image: `ghcr.io/${githubRepo.toLowerCase()}`,
}

const config = {
  github,
  githubRepo,
  urls,
  docker,
}

export default config
