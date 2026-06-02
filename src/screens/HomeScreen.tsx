import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { colors, radius, spacing, fontFamily, shadow, listThemes, CATEGORY_COLORS } from '../theme';
import { useStore } from '../store/useStore';
import { todayKey } from '../lib/dates';
import { occursOn, isOccurrenceDone } from '../lib/recurrence';

export type Route =
  | 'tasks'
  | 'learning'
  | 'analytics'
  | 'log'
  | 'search'
  | 'settings'
  | `category:${string}`;

function Row({
  icon,
  color,
  label,
  count,
  onPress,
}: {
  icon: string;
  color: string;
  label: string;
  count?: number;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.iconWrap, { backgroundColor: color + '1f' }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
      {typeof count === 'number' && count > 0 ? <Text style={styles.count}>{count}</Text> : null}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function NewListRow({ onCreate }: { onCreate: (id: string) => void }) {
  const addCategory = useStore((s) => s.addCategory);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);

  const create = () => {
    const n = name.trim();
    if (!n) return;
    const id = addCategory(n, color);
    setName('');
    setColor(CATEGORY_COLORS[0]);
    setOpen(false);
    onCreate(id);
  };

  if (!open) {
    return (
      <Pressable style={styles.row} onPress={() => setOpen(true)}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '1f' }]}>
          <Text style={[styles.icon, { color: colors.primary }]}>＋</Text>
        </View>
        <Text style={[styles.label, { color: colors.primary, fontWeight: '600' }]}>New list</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.newWrap}>
      <View style={styles.newInputRow}>
        <View style={[styles.swatch, { backgroundColor: color }]} />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="List name"
          placeholderTextColor={colors.textDim}
          style={styles.newInput}
          autoFocus
          onSubmitEditing={create}
          returnKeyType="done"
        />
        <Pressable onPress={() => { setOpen(false); setName(''); }} hitSlop={8}>
          <Text style={styles.newCancel}>Cancel</Text>
        </Pressable>
        <Pressable onPress={create} hitSlop={8} disabled={!name.trim()}>
          <Text style={[styles.newCreate, !name.trim() && { opacity: 0.4 }]}>Create</Text>
        </Pressable>
      </View>
      <View style={styles.swatchRow}>
        {CATEGORY_COLORS.map((c) => (
          <Pressable key={c} onPress={() => setColor(c)}>
            <View
              style={[
                styles.swatchPick,
                { backgroundColor: c },
                color === c && styles.swatchPickActive,
              ]}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function HomeScreen({
  onNavigate,
  onOpenSmart,
}: {
  onNavigate: (route: Route) => void;
  onOpenSmart: (tab: 'myday' | 'important' | 'planned' | 'calendar') => void;
}) {
  const tasks = useStore((s) => s.tasks);
  const categories = useStore((s) => s.categories);
  const today = todayKey();

  const myDayCount = tasks.filter((t) => occursOn(t, today) && !isOccurrenceDone(t, today)).length;
  const importantCount = tasks.filter((t) => t.important && !isOccurrenceDone(t, t.date)).length;
  const plannedCount = tasks.filter((t) => !isOccurrenceDone(t, t.date)).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.search} onPress={() => onNavigate('search')}>
        <Text style={styles.searchIcon}>🔍</Text>
        <Text style={styles.searchText}>Search</Text>
      </Pressable>

      <View style={styles.group}>
        <Row icon="☀️" color={listThemes.myday.accent} label="My Day" count={myDayCount} onPress={() => onOpenSmart('myday')} />
        <Row icon="⭐" color={listThemes.important.accent} label="Important" count={importantCount} onPress={() => onOpenSmart('important')} />
        <Row icon="🗓️" color={listThemes.planned.accent} label="Planned" count={plannedCount} onPress={() => onOpenSmart('planned')} />
        <Row icon="🏠" color={listThemes.tasks.accent} label="Tasks" count={tasks.length} onPress={() => onNavigate('tasks')} />
        <Row icon="📅" color={listThemes.calendar.accent} label="Calendar" onPress={() => onOpenSmart('calendar')} />
      </View>

      <Text style={styles.sectionLabel}>My lists</Text>
      <View style={styles.group}>
        {categories.map((c) => {
          const count = tasks.filter((t) => t.categoryId === c.id && !isOccurrenceDone(t, t.date)).length;
          return (
            <Row
              key={c.id}
              icon="📋"
              color={c.color}
              label={c.name}
              count={count}
              onPress={() => onNavigate(`category:${c.id}` as Route)}
            />
          );
        })}
        <NewListRow onCreate={(id) => onNavigate(`category:${id}` as Route)} />
      </View>

      <Text style={styles.sectionLabel}>Plan & track</Text>
      <View style={styles.group}>
        <Row icon="📚" color={listThemes.learning.accent} label="Learning goals" onPress={() => onNavigate('learning')} />
        <Row icon="📝" color={listThemes.log.accent} label="Daily log" onPress={() => onNavigate('log')} />
        <Row icon="📊" color={listThemes.stats.accent} label="Analytics" onPress={() => onNavigate('analytics')} />
        <Row icon="⚙️" color={colors.textDim} label="Lists & settings" onPress={() => onNavigate('settings')} />
      </View>
      <View style={{ height: spacing(4) }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(1.5) },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(1.75),
    paddingVertical: spacing(1.5),
    marginBottom: spacing(2),
    ...shadow,
  },
  searchIcon: { fontSize: 15, marginRight: spacing(1) },
  searchText: { color: colors.textDim, fontSize: 15, fontFamily },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(1.5),
  },
  icon: { fontSize: 17 },
  label: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '500', fontFamily },
  count: { color: colors.textDim, fontSize: 14, marginRight: spacing(1), fontFamily },
  chevron: { color: colors.textFaint, fontSize: 20 },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    fontFamily,
    marginTop: spacing(2.5),
    marginBottom: spacing(1),
    marginLeft: spacing(0.5),
  },
  newWrap: { paddingHorizontal: spacing(1.5), paddingVertical: spacing(1.5) },
  newInputRow: { flexDirection: 'row', alignItems: 'center' },
  swatch: { width: 18, height: 18, borderRadius: 9, marginRight: spacing(1.25) },
  newInput: { flex: 1, color: colors.text, fontSize: 15, fontFamily, paddingVertical: spacing(0.5) },
  newCancel: { color: colors.textDim, fontSize: 14, fontWeight: '600', fontFamily, paddingHorizontal: spacing(1) },
  newCreate: { color: colors.primary, fontSize: 14, fontWeight: '700', fontFamily, paddingLeft: spacing(0.5) },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing(1.25), marginLeft: spacing(0.25) },
  swatchPick: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginRight: spacing(1),
    marginBottom: spacing(0.5),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchPickActive: { borderColor: colors.text },
});
