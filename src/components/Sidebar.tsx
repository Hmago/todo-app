import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { radius, spacing, fontFamily, CATEGORY_COLORS, useTheme, useThemedStyles, Palette } from '../theme';
import { useStore } from '../store/useStore';
import { todayKey } from '../lib/dates';
import { occursOn, isOccurrenceDone, occurrenceStatus } from '../lib/recurrence';
import { Tooltip } from './Tooltip';

export type NavKey =
  | 'myday'
  | 'important'
  | 'planned'
  | 'tasks'
  | 'calendar'
  | 'log'
  | 'learning'
  | 'analytics'
  | 'motivation'
  | 'search'
  | 'settings'
  | `category:${string}`;

function NavItem({
  icon,
  label,
  count,
  active,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  count?: number;
  active: boolean;
  color?: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => [
        styles.item,
        hovered && !active && styles.itemHover,
        active && styles.itemActive,
      ]}
    >
      {active ? <View style={styles.activeBar} /> : <View style={styles.activeBarSpace} />}
      <Text style={[styles.itemIcon, color ? { color } : null]}>{icon}</Text>
      <Text style={[styles.itemLabel, active && styles.itemLabelActive]} numberOfLines={1}>
        {label}
      </Text>
      {typeof count === 'number' && count > 0 ? <Text style={styles.itemCount}>{count}</Text> : null}
    </Pressable>
  );
}

export function Sidebar({ active, onSelect }: { active: NavKey; onSelect: (key: NavKey) => void }) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tasks = useStore((s) => s.tasks);
  const categories = useStore((s) => s.categories);
  const addCategory = useStore((s) => s.addCategory);
  const today = todayKey();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);

  // "Open" counts exclude both completed AND skipped occurrences. Use
  // occurrenceStatus instead of !isOccurrenceDone (which is strict completed-only).
  const myDayCount = tasks.filter((t) => occursOn(t, today) && occurrenceStatus(t, today) === 'pending').length;
  const importantCount = tasks.filter((t) => t.important && occurrenceStatus(t, t.date) === 'pending').length;
  const plannedCount = tasks.filter((t) => occurrenceStatus(t, t.date) === 'pending').length;

  const create = () => {
    const n = name.trim();
    if (!n) return;
    const id = addCategory(n, color);
    setName('');
    setColor(CATEGORY_COLORS[0]);
    setCreating(false);
    onSelect(`category:${id}` as NavKey);
  };

  return (
    <View style={styles.sidebar}>
      <View style={styles.brandRow}>
        <Text style={styles.brandMark}>✓</Text>
        <Text style={styles.brand}>To Do</Text>
      </View>

      <Pressable
        onPress={() => onSelect('search')}
        style={({ hovered }: any) => [styles.search, hovered && styles.searchHover]}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <Text style={styles.searchText}>Search</Text>
      </Pressable>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <NavItem icon="☀️" label="My Day" count={myDayCount} active={active === 'myday'} onPress={() => onSelect('myday')} />
        <NavItem icon="⭐" label="Important" count={importantCount} active={active === 'important'} onPress={() => onSelect('important')} />
        <NavItem icon="🗓️" label="Planned" count={plannedCount} active={active === 'planned'} onPress={() => onSelect('planned')} />
        <NavItem icon="📅" label="Calendar" active={active === 'calendar'} onPress={() => onSelect('calendar')} />
        <NavItem icon="🏠" label="Tasks" count={tasks.length} active={active === 'tasks'} onPress={() => onSelect('tasks')} />

        <View style={styles.divider} />

        <NavItem icon="📝" label="Daily Log" active={active === 'log'} onPress={() => onSelect('log')} />
        <NavItem icon="📚" label="Learning goals" active={active === 'learning'} onPress={() => onSelect('learning')} />
        <NavItem icon="🌟" label="Motivation" active={active === 'motivation'} onPress={() => onSelect('motivation')} />
        <NavItem icon="📊" label="Analytics" active={active === 'analytics'} onPress={() => onSelect('analytics')} />

        <View style={styles.divider} />

        {categories.map((c) => {
          const count = tasks.filter((t) => t.categoryId === c.id && occurrenceStatus(t, t.date) === 'pending').length;
          return (
            <NavItem
              key={c.id}
              icon="●"
              color={c.color}
              label={c.name}
              count={count}
              active={active === (`category:${c.id}` as NavKey)}
              onPress={() => onSelect(`category:${c.id}` as NavKey)}
            />
          );
        })}

        {creating && (
          <View style={styles.createWrap}>
            <View style={styles.createRow}>
              <View style={[styles.swatch, { backgroundColor: color }]} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="List name"
                placeholderTextColor={colors.textFaint}
                style={styles.createInput}
                autoFocus
                onSubmitEditing={create}
                returnKeyType="done"
              />
            </View>
            <View style={styles.swatchRow}>
              {CATEGORY_COLORS.map((c) => (
                <Pressable key={c} onPress={() => setColor(c)}>
                  <View style={[styles.swatchPick, { backgroundColor: c }, color === c && styles.swatchPickActive]} />
                </Pressable>
              ))}
            </View>
            <View style={styles.createActions}>
              <Pressable onPress={() => { setCreating(false); setName(''); }} hitSlop={8}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={create} hitSlop={8} disabled={!name.trim()}>
                <Text style={[styles.createBtn, !name.trim() && { opacity: 0.4 }]}>Create</Text>
              </Pressable>
            </View>
          </View>
        )}
        <View style={{ height: spacing(2) }} />
      </ScrollView>

      <View style={styles.footer}>
        <Tooltip label="New list" placement="top">
          <Pressable
            onPress={() => setCreating((v) => !v)}
            style={({ hovered }: any) => [styles.footerBtn, hovered && styles.itemHover]}
            accessibilityLabel="Create a new list"
          >
            <Text style={styles.footerPlus}>＋</Text>
            <Text style={styles.footerLabel}>New list</Text>
          </Pressable>
        </Tooltip>
        <Tooltip label="Settings" placement="top">
          <Pressable
            onPress={() => onSelect('settings')}
            style={({ hovered }: any) => [styles.gear, hovered && styles.itemHover, active === 'settings' && styles.itemActive]}
            accessibilityLabel="Open settings"
          >
            <Text style={styles.gearIcon}>⚙️</Text>
          </Pressable>
        </Tooltip>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  sidebar: {
    width: 290,
    backgroundColor: colors.sidebar,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingTop: spacing(2),
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing(2.5), marginBottom: spacing(2) },
  brandMark: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
    marginRight: spacing(1),
  },
  brand: { color: colors.text, fontSize: 18, fontWeight: '700', fontFamily },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing(1.5),
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1.25),
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginBottom: spacing(1),
  },
  searchHover: { backgroundColor: colors.surfaceAlt },
  searchIcon: { fontSize: 13, marginRight: spacing(1) },
  searchText: { color: colors.textDim, fontSize: 14, fontFamily },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing(1) },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(1.25),
    paddingRight: spacing(1.5),
    borderRadius: radius.md,
  },
  itemHover: { backgroundColor: colors.surfaceAlt },
  itemActive: { backgroundColor: colors.sidebarActive },
  activeBar: { width: 3, height: 18, borderRadius: 2, backgroundColor: colors.primary, marginRight: spacing(1) },
  activeBarSpace: { width: 3, marginRight: spacing(1) },
  itemIcon: { fontSize: 15, width: 24, textAlign: 'center', marginRight: spacing(1) },
  itemLabel: { flex: 1, color: colors.textDim, fontSize: 14, fontWeight: '500', fontFamily },
  itemLabelActive: { color: colors.text, fontWeight: '600' },
  itemCount: { color: colors.textDim, fontSize: 13, fontFamily },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing(1), marginHorizontal: spacing(1) },
  createWrap: {
    marginHorizontal: spacing(1),
    marginTop: spacing(1),
    padding: spacing(1.5),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  createRow: { flexDirection: 'row', alignItems: 'center' },
  swatch: { width: 16, height: 16, borderRadius: 8, marginRight: spacing(1.25) },
  createInput: { flex: 1, color: colors.text, fontSize: 14, fontFamily, paddingVertical: spacing(0.5) },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing(1) },
  swatchPick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: spacing(0.75),
    marginBottom: spacing(0.5),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchPickActive: { borderColor: colors.text },
  createActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: spacing(0.5) },
  cancel: { color: colors.textDim, fontSize: 13, fontWeight: '600', fontFamily, paddingHorizontal: spacing(1.5) },
  createBtn: { color: colors.primary, fontSize: 13, fontWeight: '700', fontFamily },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(1),
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(1.25),
    paddingHorizontal: spacing(1.5),
    borderRadius: radius.md,
  },
  footerPlus: { color: colors.text, fontSize: 18, fontWeight: '700', marginRight: spacing(1.5), width: 18, textAlign: 'center' },
  footerLabel: { color: colors.text, fontSize: 14, fontWeight: '600', fontFamily },
  gear: { paddingVertical: spacing(1.25), paddingHorizontal: spacing(1.5), borderRadius: radius.md },
  gearIcon: { fontSize: 16 },
});
