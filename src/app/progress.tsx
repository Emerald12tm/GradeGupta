import { ErrorState, LoadingState, Screen, TableCards } from '@/components/ui';
import { useProgressReport } from '@/data/queries';

/** Interim progress report from HAC. */
export default function ProgressScreen() {
  const { data, error, isLoading, isRefetching, refetch } = useProgressReport();
  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <TableCards table={data} />
    </Screen>
  );
}
