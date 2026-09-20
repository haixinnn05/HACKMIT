import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Old preview URL. The same content now lives on What to Expect. */
export default async function PreviewPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ visits?: string; travel?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const next = new URLSearchParams({ tab: "expect" });
  if (query.visits) next.set("visits", query.visits);
  if (query.travel) next.set("travel", query.travel);
  redirect(`/trial/${decodeURIComponent(id)}?${next.toString()}`);
}
