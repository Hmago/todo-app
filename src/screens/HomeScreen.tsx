import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { radius, spacing, fontFamily, shadow, listThemes, CATEGORY_COLORS, useTheme, useThemedStyles, Palette } from '../theme';
import { useStore } from '../store/useStore';
import { useUIPrefs } from '../store/useUIPrefs';
import { todayKey } from '../lib/dates';
import { occursOn, occurrenceStatus, currentOccurrenceKey } from '../lib/recurrence';

export type Route =
  | 'tasks'
  | 'learning'
  | 'analytics'
  | 'motivation'
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
  const styles = useThemedStyles(makeStyles);
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
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
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
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tasks = useStore((s) => s.tasks);
  const categories = useStore((s) => s.categories);
  const hideOverdue = useUIPrefs((s) => s.hideOverdueInMyDay);
  const today = todayKey();

  // Single-pass count calc, memoized so navigating to/from Home doesn't
  // re-scan all tasks four+ times. Matches the Sidebar's approach.
  const { myDayCount, importantCount, plannedCount, perCategoryCount } = useMemo(() => {
    let myDay = 0;
    let important = 0;
    let planned = 0;
    const perCat: Record<string, number> = Object.create(null);
    for (const c of categories) perCat[c.id] = 0;
    for (const t of tasks) {
      // Evaluate each task at its current occurrence (today / next due for
      // recurring tasks) rather than its fixed anchor date, so a completed
      // recurring occurrence doesn't make the task vanish from these counts.
      const occ = currentOccurrenceKey(t, today);
      const isOpen = occurrenceStatus(t, occ) === 'pending';
      if (isOpen) {
        planned += 1;
        if (t.important) important += 1;
        if (t.categoryId && perCat[t.categoryId] !== undefined) perCat[t.categoryId] += 1;
      }
      // Mirror MyDayScreen: today's pending occurrences plus overdue
      // one-shot pending tasks (skipped when the user has hidden overdue).
      // The `occursToday` branch handles recurring tasks that hit today; the
      // overdue branch only fires for occurrences that fall before today
      // (recurring tasks roll forward, so they never linger as overdue).
      const occursToday = occursOn(t, today);
      if (occursToday && occurrenceStatus(t, today) === 'pending') {
        myDay += 1;
      } else if (!hideOverdue && occ < today && isOpen) {
        myDay += 1;
      }
    }
    return { myDayCount: myDay, importantCount: important, plannedCount: planned, perCategoryCount: perCat };
  }, [tasks, categories, today, hideOverdue]);

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
          const count = perCategoryCount[c.id] ?? 0;
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
        <Row icon="🌟" color={listThemes.motivation.accent} label="Motivation" onPress={() => onNavigate('motivation')} />
        <Row icon="📝" color={listThemes.log.accent} label="Daily log" onPress={() => onNavigate('log')} />
        <Row icon="📊" color={listThemes.stats.accent} label="Analytics" onPress={() => onNavigate('analytics')} />
        <Row icon="⚙️" color={colors.textDim} label="Lists & settings" onPress={() => onNavigate('settings')} />
      </View>
      <View style={{ height: spacing(4) }} />
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
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
