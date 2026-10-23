import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Card, ErrorState, LoadingState, Screen, ToggleRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useGrades, useStudentInfo } from '@/data/queries';
import { gradeReportHtml } from '@/integrations/report';
import { shareImage, sharePdf } from '@/integrations/share';
import { letterGrade } from '@/grades/average';
import { useTheme } from '@/hooks/use-theme';
import { applyCourseOverrides, useSettings } from '@/settings/settings';
import { currentGpa } from '@/sync/sync';

/**
 * Share: a designed GPA card (as an image) or a full grade report (as a PDF), sent through
 * the phone's share sheet. Only what's shown in the preview is shared, and only when the
 * user taps Share.
 */
export default function ShareCardScreen() {
  const theme = useTheme();
  const settings = useSettings();
  const { data, isLoading, error, refetch } = useGrades();
  const student = useStudentInfo().data;
  const card = useRef<View>(null);
  const [showClasses, setShowClasses] = useState(false);
  const [busy, setBusy] = useState<'image' | 'pdf' | null>(null);

  if (isLoading) return <LoadingState />;
  if (!data) return <ErrorState error={error} onRetry={refetch} />;

  const courses = applyCourseOverrides(data.page.courses, settings.courseOverrides);
  const gpa = currentGpa(courses, settings);
  const aCount = courses.filter((c) => (c.reportedAverage ?? 0) >= 90).length;

  const run = async (kind: 'image' | 'pdf', task: () => Promise<void>) => {
    setBusy(kind);
    try {
      await task();
    } catch (e) {
      Alert.alert('Couldn’t share', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <View ref={card} collapsable={false} style={[styles.card, { backgroundColor: theme.tint }]}>
        <ThemedText type="caption" style={{ color: theme.onTint }}>
          GradeGupta
        </ThemedText>
        <ThemedText type="title" style={{ color: theme.onTint, fontSize: 56, lineHeight: 62 }}>
          {gpa.weighted?.toFixed(2) ?? '—'}
        </ThemedText>
        <ThemedText type="smallBold" style={{ color: theme.onTint }}>
          Weighted GPA · {aCount} of {courses.length} classes at an A
        </ThemedText>
        {showClasses ? (
          <View style={styles.list}>
            {courses.map((c) => (
              <View key={c.id} style={styles.listRow}>
                <ThemedText type="small" style={[styles.flex, { color: theme.onTint }]} numberOfLines={1}>
                  {c.name}
                </ThemedText>
                <ThemedText type="smallBold" style={{ color: theme.onTint }}>
                  {letterGrade(c.reportedAverage)}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <Card>
        <ToggleRow icon="list" title="Include class letter grades" value={showClasses} onChange={setShowClasses} />
      </Card>
      <Button
        title="Share image"
        icon="image"
        loading={busy === 'image'}
        onPress={() =>
          void run('image', async () => {
            const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
            await shareImage(uri);
          })
        }
      />
      <Button
        title="Share full report (PDF)"
        icon="document-text"
        variant="secondary"
        loading={busy === 'pdf'}
        onPress={() =>
          void run('pdf', () => sharePdf(gradeReportHtml({ student: student?.name, courses, gpa, generatedAt: new Date() })))
        }
      />
      <Banner text="Your name is only included in the PDF. Nothing is shared until you pick where to send it." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: 28, padding: Spacing.four, gap: Spacing.one },
  list: { marginTop: Spacing.three, gap: Spacing.one },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
