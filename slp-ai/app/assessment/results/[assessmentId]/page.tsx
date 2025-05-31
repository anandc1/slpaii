import { Suspense } from 'react';
import ResultsClient from './page-client';

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: { assessmentId: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const assessmentId = params.assessmentId;
  const isMock = searchParams.mock === 'true';

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResultsClient assessmentId={assessmentId} isMock={isMock} />
    </Suspense>
  );
}
