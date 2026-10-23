import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Divider, ListRow, Pill, Screen, SectionHeader, Segmented, TextField, ToggleRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useGrades, useSchedule, useTodoActions, useTodos } from '@/data/queries';
import { useSession } from '@/data/session';
import type { Assignment, Course } from '@/hac/types';
import { useTheme } from '@/hooks/use-theme';
import { syncDueDates } from '@/integrations/calendar';
import { teacherMailto } from '@/integrations/report';
import { useSettings, useSettingsStore } from '@/settings/settings';

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
  const [calendarStatus, setCalendarStatus] = useState<string | null>(null);
  const settings = useSettings();
  const updateSettings = useSettingsStore((s) => s.update);
  const accountId = useSession((s) => s.activeId);

  const courses = grades.data?.page.courses ?? [];
  const all: Item[] = courses.flatMap((course) => course.assignments.map((assignment) => ({ course, assignment })));
  const missing = all.filter((i) => i.assignment.isMissing);
  const upcoming = all
    .filter((i) => i.assignment.score === null && !i.assignment.isMissing && (i.assignment.dateDue ?? '') >= todayIso())
    .sort((a, b) => (a.assignment.dateDue ?? '').localeCompare(b.assignment.dateDue ?? ''));

  const open = (i: Item) => router.push({ pathname: '/class/[id]', params: { id: i.course.id } });

  const schedule = useSchedule().data ?? [];
  const emailFor = (c: Course) =>
    (schedule.find((s) => s.courseCode === c.id) ?? schedule.find((s) => s.name.toLowerCase() === c.name.toLowerCase()))?.teacherEmail;

  const dueItems = () =>
    upcoming.map((i) => ({ id: i.assignment.id, title: i.assignment.name, course: i.course.name, due: i.assignment.dateDue! }));

  const syncCalendar = async () => {
    if (!accountId) return;
    try {
      const r = await syncDueDates(dueItems(), accountId);
      setCalendarStatus(`Calendar updated: ${r.added} added, ${r.removed} removed`);
    } catch (e) {
      Alert.alert('Calendar', e instanceof Error ? e.message : 'Couldn’t update the calendar.');
    }
  };

  // With "keep in sync" on, quietly refresh the calendar whenever fresh grades arrive.
  const syncedAt = grades.data && !grades.data.cached ? grades.data.syncedAt : null;
  useEffect(() => {
    if (settings.calendarSync && syncedAt && accountId) syncDueDates(dueItems(), accountId).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncedAt, settings.calendarSync, accountId]);

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
              right={
                <View style={styles.missingRight}>
                  <Pill label="Missing" color={theme.danger} />
                  {emailFor(i.course) ? (
                    <Pressable
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Email teacher about ${i.assignment.name}`}
                      onPress={() => void Linking.openURL(teacherMailto(emailFor(i.course)!, i.course.name, i.assignment.name))}>
                      <Ionicons name="mail" size={20} color={theme.tint} />
                    </Pressable>
                  ) : null}
                </View>
              }
              onPress={() => open(i)}
            />
          </View>
        ))}
      </Card>

      <SectionHeader title={`Coming up (${upcoming.length})`} />
      <Card>
        <ListRow
          icon="calendar"
          title={calendarStatus ?? 'Add due dates to my calendar'}
          subtitle={settings.calendarSync ? 'Kept up to date in a “GradeGupta” calendar' : 'Creates a “GradeGupta” calendar on your phone'}
          onPress={() => void syncCalendar()}
        />
        <ToggleRow
          title="Keep calendar in sync"
          value={settings.calendarSync}
          onChange={(v) => {
            void updateSettings({ calendarSync: v });
            if (v) void syncCalendar();
          }}
        />
        {upcoming.length > 0 ? <Divider /> : null}
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
  missingRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  todo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2 },
  done: { textDecorationLine: 'line-through', opacity: 0.6 },
});
