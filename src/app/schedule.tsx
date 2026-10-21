import { Linking, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useSchedule } from '@/data/queries';
import { useTheme } from '@/hooks/use-theme';

/** Class schedule from HAC, with tap-to-email teachers. */
export default function ScheduleScreen() {
  const theme = useTheme();
  const { data, error, isLoading, isRefetching, refetch } = useSchedule();
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data?.length) return <EmptyState title="No schedule found" />;

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      {data.map((c) => (
        <Card key={`${c.courseCode}-${c.periods}`}>
          <ThemedText type="smallBold">
            {c.periods ? `Period ${c.periods} · ` : ''}
            {c.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {[c.room && `Room ${c.room}`, c.days && `Days ${c.days}`, c.markingPeriods].filter(Boolean).join(' · ')}
          </ThemedText>
          {c.teacherEmail ? (
            <Pressable onPress={() => Linking.openURL(`mailto:${c.teacherEmail}`)} accessibilityRole="link">
              <ThemedText type="small" style={{ color: theme.tint }}>
                {c.teacher} ✉︎
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedText type="small">{c.teacher}</ThemedText>
          )}
        </Card>
      ))}
    </Screen>
  );
}
