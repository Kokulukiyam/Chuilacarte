import WorkspaceLoader from '@/components/WorkspaceLoader';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <WorkspaceLoader slug={slug} />;
}
