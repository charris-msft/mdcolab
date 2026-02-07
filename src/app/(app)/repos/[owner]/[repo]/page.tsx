import { FileBrowserContent } from "./file-browser-content";

export function generateMetadata({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  return params.then(({ owner, repo }) => ({
    title: `${owner}/${repo} — mdcolab`,
  }));
}

export default async function RepoFileBrowserPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  return <FileBrowserContent owner={owner} repo={repo} />;
}
