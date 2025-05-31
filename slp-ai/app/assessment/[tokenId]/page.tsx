import React, { Suspense } from "react";
import ClientPage from "./page-client";

export default async function AssessmentPage({
  params,
}: {
  params: { tokenId: string };
}) {
  const { tokenId } = await params;

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ClientPage tokenId={tokenId} />
    </Suspense>
  );
}

/// comentnsing
