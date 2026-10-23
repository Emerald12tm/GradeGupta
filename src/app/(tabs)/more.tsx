import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card, Divider, ListRow, Screen, SectionHeader, type IconName } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useStudentInfo } from '@/data/queries';
import { useSession } from '@/data/session';
import { useTheme } from '@/hooks/use-theme';
import { accountLabel } from '@/storage/accounts';

/** More tab: saved accounts (tap to switch), calculators, every other HAC page, settings and legal. */

type Item = { title: string; subtitle: string; href: Href; icon: IconName };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Plan',
    items: [
      { title: 'Final exam planner', subtitle: 'Score needed on every final, all at once', href: '/finals', icon: 'school' },
      { title: 'Final exam calculator', subtitle: 'What you need, what you got, hidden grades', href: '/calculator', icon: 'calculator' },
      { title: 'GPA planner', subtitle: 'See your GPA if you finish with these grades', href: '/gpa-planner', icon: 'trending-up' },
      { title: 'Compare marking periods', subtitle: 'Every class, MP by MP', href: '/compare', icon: 'git-compare' },
    ],
  },
  {
    title: 'Share',
    items: [{ title: 'Share grades', subtitle: 'GPA card image or full PDF report', href: '/share-card', icon: 'share-social' }],
  },
  {
    title: 'School',
    items: [
      { title: 'Schedule', subtitle: 'Periods, rooms, teachers', href: '/schedule', icon: 'time' },
      { title: 'Report card', subtitle: 'Grading period, exam and semester grades', href: '/report-card', icon: 'document-text' },
      { title: 'Progress report', subtitle: 'Interim progress grades', href: '/progress', icon: 'pulse' },
      { title: 'Transcript & GPA', subtitle: 'Past years, credits, official GPA and rank', href: '/transcript', icon: 'ribbon' },
      { title: 'Attendance', subtitle: 'Absences and tardies this month', href: '/attendance', icon: 'calendar' },
    ],
  },
  {
    title: 'App',
    items: [
      { title: 'Settings', subtitle: 'Theme, accounts, GPA scale, alerts, Face ID', href: '/settings', icon: 'settings' },
      { title: 'About & legal', subtitle: 'Privacy policy, terms, disclaimers', href: '/legal', icon: 'shield-checkmark' },
    ],
  },
];

export default function MoreScreen() {
  const theme = useTheme();
  const student = useStudentInfo().data;
  const { accounts, activeId, switchAccount } = useSession();

  return (
    <Screen title="More">
      <View style={styles.section}>
        <SectionHeader title="Accounts" />
        <Card>
          {accounts.map((a, i) => {
            const active = a.id === activeId;
            const details = active
              ? [student?.grade && `Grade ${student.grade}`, student?.building ?? a.districtName].filter(Boolean).join(' · ')
              : [a.districtName ?? new URL(a.baseUrl).host, a.username].join(' · ');
            return (
              <View key={a.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  icon={active ? 'person-circle' : 'person-circle-outline'}
                  iconColor={active ? theme.tint : theme.textSecondary}
                  title={accountLabel(a)}
                  subtitle={details || a.username}
                  right={active ? <Ionicons name="checkmark-circle" size={22} color={theme.tint} /> : undefined}
                  onPress={active ? undefined : () => void switchAccount(a.id)}
                />
              </View>
            );
          })}
          <Divider />
          <ListRow icon="add" title="Add account" subtitle="A sibling, or another district" onPress={() => router.push('/add-account')} />
        </Card>
      </View>

      {SECTIONS.map((s) => (
        <View key={s.title} style={styles.section}>
          <SectionHeader title={s.title} />
          <Card>
            {s.items.map((item, i) => (
              <View key={item.title}>
                {i > 0 ? <Divider /> : null}
                <ListRow icon={item.icon} title={item.title} subtitle={item.subtitle} onPress={() => router.push(item.href)} />
              </View>
            ))}
          </Card>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({ section: { gap: Spacing.two } });
