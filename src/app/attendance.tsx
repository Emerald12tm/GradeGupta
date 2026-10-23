import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Divider, EmptyState, ErrorState, ListRow, LoadingState, Pill, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAttendance } from '@/data/queries';
import { summarizeAttendance } from '@/grades/attendance';
import { useTheme } from '@/hooks/use-theme';

/**
 * Attendance for the month HAC is showing (usually the current month): a count of each
 * kind of event, then the days themselves.
 */
export default function AttendanceScreen() {
  const theme = useTheme();
  const { data, error, isLoading, isRefetching, refetch } = useAttendance();
  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <ThemedText type="smallBold">{data.month || 'This month'}</ThemedText>
      {data.days.length > 0 ? (
        <View style={styles.stats}>
          {summarizeAttendance(data.days).map((s) => (
            <Pill key={s.type} label={`${s.count} ${s.type}`} color={/absen/i.test(s.type) ? theme.danger : theme.warning} />
          ))}
        </View>
      ) : null}
      {data.days.length === 0 ? (
        <EmptyState title="Perfect attendance" message="No absences or tardies this month." icon="checkmark-circle" />
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

const styles = StyleSheet.create({ stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two } });
