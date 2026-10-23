import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { gradeColor, Spacing } from '@/constants/theme';
import { useGrades, useGradesForPeriods } from '@/data/queries';
import { useTheme } from '@/hooks/use-theme';

/**
 * Compare marking periods: each class's average in every marking period side by side,
 * with the change from the previous one.
 */
export default function CompareScreen() {
  const theme = useTheme();
  const current = useGrades();
  const periods = current.data?.page.markingPeriods ?? [];
  const all = useGradesForPeriods(periods.map((p) => p.value));

  if (current.isLoading || (periods.length > 0 && all.isLoading)) return <LoadingState label="Loading each marking period…" />;
  if (current.error && !current.data) return <ErrorState error={current.error} onRetry={current.refetch} />;
  if (periods.length < 2) return <EmptyState title="Only one marking period so far" message="Come back after the next one starts." />;
  if (!all.data) return <ErrorState error={all.error} onRetry={all.refetch} />;

  const names = [...new Set(all.data.flatMap((d) => d.page.courses.map((c) => c.name)))];
  const avg = (i: number, name: string) => all.data[i].page.courses.find((c) => c.name === name)?.reportedAverage ?? null;

  return (
    <Screen>
      {names.map((name) => {
        const values = periods.map((_, i) => avg(i, name));
        const known = values.filter((v): v is number => v !== null);
        const change = known.length >= 2 ? known[known.length - 1] - known[known.length - 2] : null;
        return (
          <Card key={name}>
            <View style={styles.titleRow}>
              <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
                {name}
              </ThemedText>
              {change !== null && Math.abs(change) >= 0.01 ? (
                <View style={styles.change}>
                  <Ionicons name={change > 0 ? 'arrow-up' : 'arrow-down'} size={14} color={change > 0 ? theme.success : theme.danger} />
                  <ThemedText type="smallBold" style={{ color: change > 0 ? theme.success : theme.danger }}>
                    {Math.abs(change).toFixed(2)}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cells}>
              {periods.map((p, i) => (
                <View key={p.value} style={[styles.cell, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <ThemedText type="caption" themeColor="textSecondary">
                    MP {p.label}
                  </ThemedText>
                  <ThemedText type="smallBold" style={{ color: gradeColor(values[i], theme), fontSize: 17, lineHeight: 22 }}>
                    {values[i] === null ? '—' : values[i]!.toFixed(1)}
                  </ThemedText>
                </View>
              ))}
            </ScrollView>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  change: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cells: { gap: Spacing.two },
  cell: { minWidth: 76, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingVertical: Spacing.two, paddingHorizontal: Spacing.two, alignItems: 'center', gap: 2 },
});
