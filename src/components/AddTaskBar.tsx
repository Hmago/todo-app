import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import { radius, spacing, fontFamily, shadow, useTheme, useThemedStyles, Palette } from '../theme';
import { Category } from '../types';
import { parseQuickAdd, describeParse } from '../lib/quickAdd';

export function AddTaskBar({
  accent,
  placeholder = 'Add a task',
  onAdd,
  onExpand,
  categories,
}: {
  accent: string;
  placeholder?: string;
  onAdd: (title: string) => void;
  onExpand?: () => void;
  categories?: Category[];
}) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [value, setValue] = useState('');

  const preview = useMemo(() => {
    if (!categories || !value.trim()) return [];
    return describeParse(parseQuickAdd(value, categories), categories);
  }, [value, categories]);

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    onAdd(t);
    setValue('');
  };

  return (
    <View style={styles.wrap}>
      {preview.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.preview} keyboardShouldPersistTaps="handled">
          {preview.map((c, i) => (
            <View key={i} style={[styles.previewChip, { borderColor: accent }]}>
              <Text style={[styles.previewText, { color: accent }]}>{c}</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View style={[styles.bar, { borderColor: value ? accent : colors.border }]}>
        <View style={[styles.circle, { borderColor: value ? accent : colors.textFaint }]} />
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          onSubmitEditing={submit}
          returnKeyType="done"
          blurOnSubmit={false}
        />
        {onExpand ? (
          <Pressable onPress={onExpand} hitSlop={8} style={styles.expand}>
            <Text style={[styles.expandText, { color: accent }]}>⋯</Text>
          </Pressable>
        ) : null}
        {value.trim() ? (
          <Pressable onPress={submit} hitSlop={8}>
            <Text style={[styles.add, { color: accent }]}>Add</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing(3),
    paddingTop: spacing(1),
    paddingBottom: spacing(2),
    backgroundColor: colors.bg,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing(2),
    paddingVertical: Platform.OS === 'ios' ? spacing(1.5) : spacing(1.25),
    ...shadow,
  },
  circle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    marginRight: spacing(1.5),
  },
  input: { flex: 1, color: colors.text, fontSize: 15, fontFamily, paddingVertical: spacing(0.5) },
  preview: { marginBottom: spacing(1) },
  previewChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.5),
    marginRight: spacing(0.75),
    backgroundColor: colors.surface,
  },
  previewText: { fontSize: 12, fontWeight: '600', fontFamily },
  expand: { paddingHorizontal: spacing(1) },
  expandText: { fontSize: 20, fontWeight: '700' },
  add: { fontSize: 14, fontWeight: '700', fontFamily, paddingLeft: spacing(0.5) },
});
