import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Small set of shared building blocks so every screen looks and behaves the same.
 * Everything reads colors from `useTheme()` and works in light and dark mode.
 */

/**
 * Scrollable page. Pass `title` on tab screens (which have no navigation header) to get a
 * large title and safe-area padding; stack screens get their title from the header instead.
 */
export function Screen({
  children,
  title,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  title?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior={title ? 'never' : 'automatic'}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.screen,
        title ? { paddingTop: insets.top + Spacing.three, paddingBottom: BottomTabInset + insets.bottom + Spacing.six } : null,
      ]}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}>
      {title ? (
        <ThemedText type="subtitle" accessibilityRole="header">
          {title}
        </ThemedText>
      ) : null}
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const body = (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, style]}>{children}</View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {action}
    </View>
  );
}

/** A row inside a Card: title/subtitle on the left, anything on the right. */
export function ListRow({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <ThemedText numberOfLines={2}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border }} />;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  const theme = useTheme();
  const bg = variant === 'primary' ? theme.tint : variant === 'danger' ? theme.danger : theme.backgroundSelected;
  const fg = variant === 'secondary' ? theme.text : theme.onTint;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
      {loading ? <ActivityIndicator color={fg} /> : <ThemedText style={{ color: fg, fontWeight: '600' }}>{title}</ThemedText>}
    </Pressable>
  );
}

export function TextField({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
        accessibilityLabel={label}
        {...props}
      />
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** Number entry that keeps the raw text (so "8" → "89" typing works) and reports the parsed value. */
export function NumberField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={(t) => onChangeText(t.replace(/[^0-9.]/g, ''))}
      keyboardType="decimal-pad"
      placeholder={placeholder}
      hint={hint}
    />
  );
}

/** Parses NumberField text; empty or invalid → null. */
export const toNumber = (text: string): number | null => {
  if (text.trim() === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.backgroundSelected }]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'} numberOfLines={1}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Pill({ label, color }: { label: string; color?: string }) {
  const theme = useTheme();
  const c = color ?? theme.textSecondary;
  return (
    <View style={[styles.pill, { borderColor: c }]}>
      <ThemedText type="small" style={{ color: c }}>
        {label}
      </ThemedText>
    </View>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return <ListRow title={title} subtitle={subtitle} right={<Switch value={value} onValueChange={onChange} />} />;
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator />
      <ThemedText themeColor="textSecondary">{label}</ThemedText>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <View style={styles.center}>
      <ThemedText type="smallBold">Couldn’t load this</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.centerText}>
        {message}
      </ThemedText>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <View style={styles.center}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {message ? (
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          {message}
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * Renders an HAC grid (report card, progress report) as one card per row, so wide tables
 * stay readable on a phone. `titleKeys` picks the header used as each card's title.
 */
export function TableCards({
  table,
  titleKeys = ['Description', 'Course'],
}: {
  table: { headers: string[]; rows: Record<string, string>[] };
  titleKeys?: string[];
}) {
  if (table.rows.length === 0) return <EmptyState title="Nothing posted yet" />;
  return (
    <>
      {table.rows.map((row, i) => {
        const titleKey = titleKeys.find((k) => row[k]);
        const cells = table.headers.filter((h) => h !== titleKey && row[h]);
        return (
          <Card key={i}>
            <ThemedText type="smallBold">{titleKey ? row[titleKey] : `Row ${i + 1}`}</ThemedText>
            <View style={styles.cells}>
              {cells.map((h) => (
                <View key={h} style={styles.cell}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {h}
                  </ThemedText>
                  <ThemedText type="small">{row[h]}</ThemedText>
                </View>
              ))}
            </View>
          </Card>
        );
      })}
    </>
  );
}

export function Banner({ text, tone = 'info' }: { text: string; tone?: 'info' | 'warning' }) {
  const theme = useTheme();
  const color = tone === 'warning' ? theme.warning : theme.tint;
  return (
    <View style={[styles.banner, { borderColor: color }]}>
      <ThemedText type="small" style={{ color }}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six * 2,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  pressed: { opacity: 0.7 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 44,
  },
  rowText: { flex: 1, gap: Spacing.half },
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  field: { gap: Spacing.one },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  segmented: { flexDirection: 'row', borderRadius: 10, padding: 2 },
  segment: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingHorizontal: Spacing.one },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.two, paddingVertical: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  centerText: { textAlign: 'center' },
  banner: { borderWidth: 1, borderRadius: 12, padding: Spacing.two },
  cells: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  cell: { minWidth: 64 },
});
