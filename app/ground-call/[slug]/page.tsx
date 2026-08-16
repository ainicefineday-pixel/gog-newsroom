import { GroundCallClipPage } from "./clip-page";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <GroundCallClipPage slug={slug} />;
}
