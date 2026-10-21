import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Divider, ListRow, Pill, Screen, SectionHeader, Segmented, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useGrades, useTodoActions, useTodos } from '@/data/queries';
import type { Assignment, Course } from '@/hac/types';
import { useTheme } from '@/hooks/use-theme';

/**
 * Planner tab: missing work, assignments due soon (from HAC), and your own to-dos with
 * optional reminders.
 */

type Item = { course: Course; assignment: Assignment };

const todayIso = () => new Date().toISOString().slice(0, 10);

const REMINDERS = {
  none: { label: 'No reminder', at: () => null },
  tonight: { label: 'Tonight 7pm', at: () => atHour(0, 19) },
  tomorrow: { label: 'Tomorrow 7am', at: () => atHour(1, 7) },
  twoDays: { label: 'In 2 days', at: () => atHour(2, 17) },
} as const;
type ReminderKey = keyof typeof REMINDERS;

function atHour(daysFromNow: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const formatDue = (iso?: string) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '';

export default function PlannerScreen() {
  const theme = useTheme();
  const grades = useGrades();
  const todos = useTodos();
  const { add, toggle, remove } = useTodoActions();
  const [title, setTitle] = useState('');
  const [reminder, setReminder] = useState<ReminderKey>('none');

  const courses = grades.data?.page.courses ?? [];
  const all: Item[] = courses.flatMap((course) => course.assignments.map((assignment) => ({ course, assignment })));
  const missing = all.filter((i) => i.assignment.isMissing);
  const upcoming = all
    .filter((i) => i.assignment.score === null && !i.assignment.isMissing && (i.assignment.dateDue ?? '') >= todayIso())
    .sort((a, b) => (a.assignment.dateDue ?? '').localeCompare(b.assignment.dateDue ?? ''));

  const open = (i: Item) => router.push({ pathname: '/class/[id]', params: { id: i.course.id } });

  return (
    <Screen title="Planner" refreshing={grades.isRefetching} onRefresh={grades.refetch}>
      <SectionHeader title="To-do" />
      <Card>
        <TextField label="Add a task" value={title} onChangeText={setTitle} placeholder="Study for chem quiz" returnKeyType="done" />
        <Segmented
          options={(Object.keys(REMINDERS) as ReminderKey[]).map((k) => ({ value: k, label: REMINDERS[k].label }))}
          value={reminder}
          onChange={setReminder}
        />
        <Button
          title="Add"
          disabled={!title.trim()}
          loading={add.isPending}
          onPress={() =>
            add.mutate(
              { title: title.trim(), due: REMINDERS[reminder].at(), courseId: null },
              { onSuccess: () => (setTitle(''), setReminder('none')) },
            )
          }
        />
        {(todos.data ?? []).map((t) => (
          <View key={t.id}>
            <Divider />
            <View style={styles.todo}>
              <Pressable
                onPress={() => toggle.mutate(t)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: t.done }}
                style={[styles.check, { borderColor: theme.tint, backgroundColor: t.done ? theme.tint : 'transparent' }]}
              />
              <View style={styles.flex}>
                <ThemedText style={t.done ? styles.done : undefined}>{t.title}</ThemedText>
                {t.due ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {new Date(t.due).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                  </ThemedText>
                ) : null}
              </View>
              <Pressable onPress={() => remove.mutate(t)} accessibilityRole="button" accessibilityLabel={`Delete ${t.title}`}>
                <ThemedText type="small" style={{ color: theme.danger }}>
                  Delete
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ))}
      </Card>

      <SectionHeader title={`Missing (${missing.length})`} />
      <Card>
        {missing.length === 0 ? <ThemedText themeColor="textSecondary">Nothing missing. 🎉</ThemedText> : null}
        {missing.map((i, n) => (
          <View key={i.assignment.id}>
            {n > 0 ? <Divider /> : null}
            <ListRow
              title={i.assignment.name}
              subtitle={`${i.course.name} · due ${formatDue(i.assignment.dateDue)}`}
              right={<Pill label="Missing" color={theme.danger} />}
              onPress={() => open(i)}
            />
          </View>
        ))}
      </Card>

      <SectionHeader title={`Coming up (${upcoming.length})`} />
      <Card>
        {upcoming.length === 0 ? (
          <ThemedText themeColor="textSecondary">No upcoming assignments posted in HAC yet.</ThemedText>
        ) : null}
        {upcoming.map((i, n) => (
          <View key={i.assignment.id}>
            {n > 0 ? <Divider /> : null}
            <ListRow
              title={i.assignment.name}
              subtitle={`${i.course.name} · ${i.assignment.category}`}
              right={<ThemedText type="small">{formatDue(i.assignment.dateDue)}</ThemedText>}
              onPress={() => open(i)}
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  todo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2 },
  done: { textDecorationLine: 'line-through', opacity: 0.6 },
});
