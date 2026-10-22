import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
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
import { BottomTabInset, gradeColor, MaxContentWidth, Spacing } from '@/constants/theme';
import { letterGrade } from '@/grades/average';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shared building blocks so every screen looks and behaves the same.
 * Everything reads colors from `useTheme()`, so it follows the chosen theme in light and dark.
 *
 * Visual language: soft rounded cards with a subtle shadow (border in dark mode, where
 * shadows don't show), tinted icon tiles, filled pills, and light haptics on taps.
 */

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** `#RRGGBB` + alpha (0–1) → `#RRGGBBAA`, for tinted backgrounds. */
export const withAlpha = (hex: string, alpha: number): string =>
  `${hex.slice(0, 7)}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** Light tap feedback. No-op where haptics aren't available (web, some emulators). */
export const tapFeedback = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

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
        title ? { paddingTop: insets.top + Spacing.four, paddingBottom: BottomTabInset + insets.bottom + Spacing.six } : null,
      ]}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.tint} colors={[theme.tint]} /> : undefined
      }>
      {title ? (
        <ThemedText type="largeTitle" accessibilityRole="header">
          {title}
        </ThemedText>
      ) : null}
      {children}
    </ScrollView>
  );
}

/** Surface style for cards: shadow in light mode, hairline border in dark mode. */
function useSurface(): ViewStyle {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  return {
    backgroundColor: theme.backgroundElement,
    borderColor: dark ? theme.border : 'transparent',
    borderWidth: dark ? StyleSheet.hairlineWidth : 0,
    ...(dark ? {} : styles.shadow),
  };
}

export function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const surface = useSurface();
  if (!onPress) return <View style={[styles.card, surface, style]}>{children}</View>;
  return (
    <Pressable
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.card, surface, style, pressed && styles.pressedScale]}>
      {children}
    </Pressable>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="caption" themeColor="textSecondary">
        {title}
      </ThemedText>
      {action}
    </View>
  );
}

/** Rounded tinted square holding an icon, used at the start of list rows. */
export function IconTile({ name, color }: { name: IconName; color?: string }) {
  const theme = useTheme();
  const c = color ?? theme.tint;
  return (
    <View style={[styles.iconTile, { backgroundColor: withAlpha(c, 0.14) }]}>
      <Ionicons name={name} size={18} color={c} />
    </View>
  );
}

/** A row inside a Card: optional icon, title/subtitle, and anything (or a chevron) on the right. */
export function ListRow({
  title,
  subtitle,
  right,
  icon,
  iconColor,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  icon?: IconName;
  iconColor?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const content = (
    <View style={styles.row}>
      {icon ? <IconTile name={icon} color={iconColor} /> : null}
      <View style={styles.rowText}>
        <ThemedText numberOfLines={2}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} /> : null)}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      accessibilityRole="button"
      style={({ pressed }) => pressed && styles.pressed}>
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
  icon,
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
}) {
  const theme = useTheme();
  const bg = variant === 'primary' ? theme.tint : variant === 'danger' ? withAlpha(theme.danger, 0.14) : withAlpha(theme.tint, 0.12);
  const fg = variant === 'primary' ? theme.onTint : variant === 'danger' ? theme.danger : theme.tint;
  return (
    <Pressable
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.45 : 1 }, pressed && styles.pressedScale]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <ThemedText style={{ color: fg, fontWeight: '700' }}>{title}</ThemedText>
        </>
      )}
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
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
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
            onPress={() => {
              if (!active) tapFeedback();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && [{ backgroundColor: theme.backgroundElement }, styles.segmentShadow]]}>
            <ThemedText
              type={active ? 'smallBold' : 'small'}
              style={{ color: active ? theme.text : theme.textSecondary }}
              numberOfLines={1}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Pill({ label, color, icon }: { label: string; color?: string; icon?: IconName }) {
  const theme = useTheme();
  const c = color ?? theme.textSecondary;
  return (
    <View style={[styles.pill, { backgroundColor: withAlpha(c, 0.14) }]}>
      {icon ? <Ionicons name={icon} size={12} color={c} /> : null}
      <ThemedText type="small" style={{ color: c, fontWeight: '600', fontSize: 12, lineHeight: 16 }}>
        {label}
      </ThemedText>
    </View>
  );
}

/** Rounded badge with the average (colored by letter grade) and the letter beneath it. */
export function GradeBadge({ average, size = 'medium' }: { average: number | null; size?: 'medium' | 'large' }) {
  const theme = useTheme();
  const color = gradeColor(average, theme);
  const large = size === 'large';
  return (
    <View
      style={[styles.badge, large && styles.badgeLarge, { backgroundColor: withAlpha(color === theme.text ? theme.tint : color, 0.12) }]}
      accessibilityLabel={average === null ? 'No grade yet' : `Average ${average.toFixed(2)}, ${letterGrade(average)}`}>
      <ThemedText type={large ? 'title' : 'subtitle'} style={{ color: color === theme.text ? theme.tint : color }}>
        {average === null ? '—' : large ? average.toFixed(2) : average.toFixed(1)}
      </ThemedText>
      <ThemedText type="caption" style={{ color: color === theme.text ? theme.tint : color }}>
        {letterGrade(average)}
      </ThemedText>
    </View>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  icon,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  icon?: IconName;
}) {
  const theme = useTheme();
  return (
    <ListRow
      title={title}
      subtitle={subtitle}
      icon={icon}
      right={
        <Switch
          value={value}
          onValueChange={(v) => {
            tapFeedback();
            onChange(v);
          }}
          trackColor={{ true: theme.tint, false: theme.backgroundSelected }}
          thumbColor={Platform.OS === 'android' ? theme.backgroundElement : undefined}
        />
      }
    />
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.center, styles.fill, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.tint} />
      <ThemedText themeColor="textSecondary">{label}</ThemedText>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const theme = useTheme();
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <View style={[styles.center, styles.fill, { backgroundColor: theme.background }]}>
      <IconTile name="cloud-offline-outline" color={theme.warning} />
      <ThemedText type="smallBold">Couldn’t load this</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.centerText}>
        {message}
      </ThemedText>
      {onRetry ? <Button title="Try again" variant="secondary" icon="refresh" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ title, message, icon = 'sparkles-outline' }: { title: string; message?: string; icon?: IconName }) {
  return (
    <View style={styles.center}>
      <IconTile name={icon} />
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
                  <ThemedText type="caption" themeColor="textSecondary">
                    {h}
                  </ThemedText>
                  <ThemedText type="smallBold">{row[h]}</ThemedText>
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
    <View style={[styles.banner, { backgroundColor: withAlpha(color, 0.12) }]}>
      <Ionicons name={tone === 'warning' ? 'alert-circle' : 'information-circle'} size={18} color={color} />
      <ThemedText type="small" style={[styles.flex, { color: theme.text }]}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { flex: 1 },
  screen: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six * 2,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  shadow: Platform.select<ViewStyle>({
    ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: 2 },
    default: { boxShadow: '0 4px 16px rgba(0,0,0,0.06)' },
  }) as ViewStyle,
  pressed: { opacity: 0.6 },
  pressedScale: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  iconTile: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 48,
  },
  rowText: { flex: 1, gap: Spacing.half },
  button: {
    minHeight: 52,
    borderRadius: 16,
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  field: { gap: Spacing.one },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segment: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9, paddingHorizontal: Spacing.one },
  segmentShadow: Platform.select<ViewStyle>({
    ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
    android: { elevation: 1 },
    default: {},
  }) as ViewStyle,
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  badge: { minWidth: 72, borderRadius: 16, paddingVertical: Spacing.one, paddingHorizontal: Spacing.two, alignItems: 'center' },
  badgeLarge: { minWidth: 120, borderRadius: 20, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.six, paddingHorizontal: Spacing.four },
  centerText: { textAlign: 'center' },
  banner: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start', borderRadius: 14, padding: Spacing.three },
  cells: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  cell: { minWidth: 64, gap: 2 },
});
