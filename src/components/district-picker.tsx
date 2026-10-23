import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Divider } from '@/components/ui';
import { DISTRICTS, searchDistricts, type District } from '@/config/districts';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * District chooser: a field that opens a full-height, searchable, scrollable list of known
 * HAC districts. "My district isn't listed" switches the sign-in form to typing an address.
 */

/** `district` when picked from the list; `custom` when the user will type an address. */
export type DistrictChoice = { kind: 'district'; district: District } | { kind: 'custom' } | null;

export function DistrictPicker({ value, onChange }: { value: DistrictChoice; onChange: (choice: DistrictChoice) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchDistricts(query), [query]);

  const choose = (choice: DistrictChoice) => {
    onChange(choice);
    setOpen(false);
    setQuery('');
  };

  const label =
    value?.kind === 'district' ? value.district.name : value?.kind === 'custom' ? 'Other district (enter address)' : 'Choose your district';

  const unlisted = (
    <Pressable onPress={() => choose({ kind: 'custom' })} accessibilityRole="button" style={styles.row}>
      <ThemedText style={{ color: theme.tint }}>My district isn’t listed</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Enter your district’s HAC address instead
      </ThemedText>
    </Pressable>
  );

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">District</ThemedText>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`District: ${label}. Tap to change.`}
        style={[styles.input, { borderColor: theme.track, backgroundColor: theme.backgroundElement }]}>
        <ThemedText themeColor={value ? 'text' : 'textSecondary'} numberOfLines={1} style={styles.flex}>
          {label}
        </ThemedText>
        <ThemedText themeColor="textSecondary">▾</ThemedText>
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <ThemedText type="smallBold" style={styles.flex}>
              Choose your district
            </ThemedText>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" hitSlop={12}>
              <ThemedText style={{ color: theme.tint }}>Close</ThemedText>
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${DISTRICTS.length} districts (name, city or "cfisd")`}
            placeholderTextColor={theme.textSecondary}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            accessibilityLabel="Search districts"
            style={[styles.search, { color: theme.text, borderColor: theme.track, backgroundColor: theme.backgroundElement }]}
          />
          <FlatList
            data={results}
            keyExtractor={(d) => d.url}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ItemSeparatorComponent={Divider}
            renderItem={({ item }) => {
              const selected = value?.kind === 'district' && value.district.url === item.url;
              return (
                <Pressable
                  onPress={() => choose({ kind: 'district', district: item })}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText style={selected ? { color: theme.tint } : undefined}>
                    {item.name}
                    {selected ? '  ✓' : ''}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.city} · {new URL(item.url).host}
                  </ThemedText>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                No district matches “{query}”.
              </ThemedText>
            }
            ListFooterComponent={
              <>
                <Divider />
                {unlisted}
              </>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: { gap: Spacing.one },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sheet: { flex: 1, paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  search: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: Spacing.three, fontSize: 16 },
  row: { paddingVertical: Spacing.three, gap: Spacing.half },
  empty: { paddingVertical: Spacing.four, textAlign: 'center' },
});
