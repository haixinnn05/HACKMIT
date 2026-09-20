import { redirect } from "next/navigation";

export default async function NewInquiryPage({ params }: { params: Promise<{ trialId: string }> }) {
  const { trialId } = await params;
  redirect(`/apply/${encodeURIComponent(trialId)}`);
}
