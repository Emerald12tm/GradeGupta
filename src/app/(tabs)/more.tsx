import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Divider, ListRow, Screen, SectionHeader } from '@/components/ui';
import { useStudentInfo } from '@/data/queries';
import { useSession } from '@/data/session';

/** More tab: the student, calculators, every other HAC page, and settings. */

const SECTIONS: { title: string; items: { title: string; subtitle: string; href: Href }[] }[] = [
  {
    title: 'Calculators',
    items: [
      { title: 'Final exam calculator', subtitle: 'What you need, what you got, and hidden grades', href: '/calculator' },
    ],
  },
  {
    title: 'School',
    items: [
      { title: 'Schedule', subtitle: 'Periods, rooms, teachers', href: '/schedule' },
      { title: 'Report card', subtitle: 'Grading period, exam and semester grades', href: '/report-card' },
      { title: 'Progress report', subtitle: 'Interim progress grades', href: '/progress' },
      { title: 'Transcript & GPA', subtitle: 'Past years, credits, official GPA and rank', href: '/transcript' },
      { title: 'Attendance', subtitle: 'Absences and tardies this month', href: '/attendance' },
    ],
  },
  {
    title: 'App',
    items: [{ title: 'Settings', subtitle: 'GPA scale, semester formula, alerts, Face ID', href: '/settings' }],
  },
];

export default function MoreScreen() {
  const student = useStudentInfo().data;
  const username = useSession((s) => s.username);

  return (
    <Screen title="More">
      <Card>
        <ThemedText type="smallBold">{student?.name ?? username}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {[student?.grade && `Grade ${student.grade}`, student?.building].filter(Boolean).join(' · ') || 'Home Access Center'}
        </ThemedText>
      </Card>
      {SECTIONS.map((s) => (
        <View key={s.title}>
          <SectionHeader title={s.title} />
          <Card>
            {s.items.map((item, i) => (
              <View key={item.title}>
                {i > 0 ? <Divider /> : null}
                <ListRow title={item.title} subtitle={item.subtitle} right={<ThemedText themeColor="textSecondary">›</ThemedText>} onPress={() => router.push(item.href)} />
              </View>
            ))}
          </Card>
        </View>
      ))}
    </Screen>
  );
}
