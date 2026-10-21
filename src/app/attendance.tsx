import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Divider, EmptyState, ErrorState, ListRow, LoadingState, Screen } from '@/components/ui';
import { useAttendance } from '@/data/queries';

/** Attendance events for the month HAC is showing (usually the current month). */
export default function AttendanceScreen() {
  const { data, error, isLoading, isRefetching, refetch } = useAttendance();
  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <ThemedText type="smallBold">{data.month || 'This month'}</ThemedText>
      {data.days.length === 0 ? (
        <EmptyState title="Perfect attendance" message="No absences or tardies this month." />
      ) : (
        <Card>
          {data.days.map((d, i) => (
            <View key={d.date}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={new Date(`${d.date}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                subtitle={d.events.join(' · ')}
              />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
