import { router } from 'expo-router';

import { Button, ErrorState, LoadingState, Screen, TableCards } from '@/components/ui';
import { useReportCard } from '@/data/queries';

/** Report card grid from HAC (grading period, exam and semester columns vary by district). */
export default function ReportCardScreen() {
  const { data, error, isLoading, isRefetching, refetch } = useReportCard();
  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Button title="Open the final exam calculator" variant="secondary" onPress={() => router.push('/calculator')} />
      <TableCards table={data} />
    </Screen>
  );
}
