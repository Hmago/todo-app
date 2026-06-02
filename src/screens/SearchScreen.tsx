import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable } from 'react-native';
import { colors, radius, spacing, fontFamily, shadow } from '../theme';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { useSavedFilters, SearchStatus } from '../store/useSavedFilters';
import { TaskRow } from '../components/TaskRow';
import { ListHeader } from '../components/ListHeader';
import { Chip, EmptyState } from '../components/ui';
import { isOccurrenceDone } from '../lib/recurrence';
import { todayKey } from '../lib/dates';
import { Task, Category } from '../types';

type Preset = 'none' | 'important' | 'overdue' | 'recurring' | 'reminder' | 'high';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'important', label: '⭐ Important' },
  { key: 'overdue', label: '⏰ Overdue' },
  { key: 'recurring', label: '🔁 Recurring' },
  { key: 'reminder', label: '🔔 Reminders' },
  { key: 'high', label: '🔴 High priority' },
];

function haystack(t: Task, category?: Category): string {
  const parts: string[] = [t.title, t.notes ?? '', category?.name ?? ''];
  if (t.tags) parts.push(...t.tags);
  if (t.subtasks) parts.push(...t.subtasks.map((s) => s.title));
  if (t.links) parts.push(...t.links.map((l) => `${l.label ?? ''} ${l.url}`));
  return parts.join(' \u0001 ').toLowerCase();
}

function matchesPreset(t: Task, preset: Preset, today: string): boolean {
  switch (preset) {
    case 'important':
      return !!t.important;
    case 'overdue':
      return t.date < today && !isOccurrenceDone(t, t.date);
    case 'recurring':
      return t.recurrence !== 'none' || !!t.recurrenceRule;
    case 'reminder':
      return (t.reminders?.length ?? 0) > 0;
    case 'high':
      return t.priority === 'high';
    default:
      return true;
  }
}

export function SearchScreen({ onBack }: { onBack?: () => void }) {
  const tasks = useStore((s) => s.tasks);
  const categories = useStore((s) => s.categories);
  const toggleComplete = useStore((s) => s.toggleComplete);
  const openEdit = useUI((s) => s.openEdit);
  const savedFilters = useSavedFilters((s) => s.filters);
  const addFilter = useSavedFilters((s) => s.addFilter);
  const deleteFilter = useSavedFilters((s) => s.deleteFilter);

  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<SearchStatus>('all');
  const [tag, setTag] = useState<string | undefined>(undefined);
  const [preset, setPreset] = useState<Preset>('none');

  const today = todayKey();

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) for (const tg of t.tags ?? []) set.add(tg);
    return Array.from(set).sort();
  }, [tasks]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const catById = new Map(categories.map((c) => [c.id, c]));
    return tasks
      .filter((t) => {
        const matchesText = !q || haystack(t, catById.get(t.categoryId ?? '')).includes(q);
        const matchesCat = !catFilter || t.categoryId === catFilter;
        const done = isOccurrenceDone(t, t.date);
        const matchesStatus = status === 'all' || (status === 'done' ? done : !done);
        const matchesTag = !tag || (t.tags ?? []).includes(tag);
        const matchesPre = matchesPreset(t, preset, today);
        return matchesText && matchesCat && matchesStatus && matchesTag && matchesPre;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [tasks, categories, query, catFilter, status, tag, preset, today]);

  const canSave = !!(query.trim() || catFilter || status !== 'all' || tag || preset !== 'none');

  const saveCurrent = () => {
    const bits: string[] = [];
    if (query.trim()) bits.push(`"${query.trim()}"`);
    if (preset !== 'none') bits.push(PRESETS.find((p) => p.key === preset)!.label.replace(/^\S+\s/, ''));
    if (catFilter) bits.push(categories.find((c) => c.id === catFilter)?.name ?? 'List');
    if (tag) bits.push(`#${tag}`);
    if (status !== 'all') bits.push(status);
    addFilter({
      name: bits.join(' · ') || 'Saved search',
      query: query.trim(),
      categoryId: catFilter,
      status,
      tag,
    });
  };

  const applySaved = (id: string) => {
    const f = savedFilters.find((x) => x.id === id);
    if (!f) return;
    setQuery(f.query);
    setCatFilter(f.categoryId);
    setStatus(f.status);
    setTag(f.tag);
    setPreset('none');
  };

  return (
    <View style={styles.screen}>
      <ListHeader themeKey="search" icon="🔍" title="Search" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search titles, notes, subtasks, tags…"
          placeholderTextColor={colors.textDim}
          style={styles.search}
          autoCapitalize="none"
          autoFocus
        />

        {savedFilters.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Saved searches</Text>
            <View style={styles.rowWrap}>
              {savedFilters.map((f) => (
                <Pressable key={f.id} style={styles.savedChip} onPress={() => applySaved(f.id)}>
                  <Text style={styles.savedText} numberOfLines={1}>
                    ★ {f.name}
                  </Text>
                  <Pressable onPress={() => deleteFilter(f.id)} hitSlop={8}>
                    <Text style={styles.savedDelete}>✕</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Smart filters</Text>
        <View style={styles.rowWrap}>
          {PRESETS.map((p) => (
            <Chip
              key={p.key}
              label={p.label}
              active={preset === p.key}
              onPress={() => setPreset(preset === p.key ? 'none' : p.key)}
            />
          ))}
        </View>

        <View style={styles.rowWrap}>
          <Chip label="All" active={status === 'all'} onPress={() => setStatus('all')} />
          <Chip label="Active" active={status === 'active'} onPress={() => setStatus('active')} />
          <Chip label="Done" active={status === 'done'} onPress={() => setStatus('done')} />
        </View>

        <View style={styles.rowWrap}>
          <Chip label="Any list" active={!catFilter} onPress={() => setCatFilter(undefined)} />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              color={c.color}
              active={catFilter === c.id}
              onPress={() => setCatFilter(catFilter === c.id ? undefined : c.id)}
            />
          ))}
        </View>

        {allTags.length > 0 ? (
          <View style={styles.rowWrap}>
            <Chip label="Any tag" active={!tag} onPress={() => setTag(undefined)} />
            {allTags.map((tg) => (
              <Chip key={tg} label={`#${tg}`} active={tag === tg} onPress={() => setTag(tag === tg ? undefined : tg)} />
            ))}
          </View>
        ) : null}

        <View style={styles.resultBar}>
          <Text style={styles.resultCount}>
            {results.length} result{results.length === 1 ? '' : 's'}
          </Text>
          {canSave ? (
            <Pressable onPress={saveCurrent} hitSlop={8}>
              <Text style={styles.saveBtn}>★ Save search</Text>
            </Pressable>
          ) : null}
        </View>

        {results.length === 0 ? (
          <EmptyState icon="🔎" title="No matches" subtitle="Try a different keyword or filter." />
        ) : (
          results.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              dateKey={t.date}
              done={isOccurrenceDone(t, t.date)}
              showDate
              onToggle={() => toggleComplete(t.id, t.date)}
              onPress={() => openEdit(t)}
            />
          ))
        )}
        <View style={{ height: spacing(4) }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(1.5) },
  search: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
    color: colors.text,
    fontSize: 16,
    fontFamily,
    marginBottom: spacing(1.5),
    ...shadow,
  },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing(0.5),
    marginBottom: spacing(0.5),
    fontFamily,
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing(0.5) },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(0.75),
    paddingHorizontal: spacing(1.25),
    marginRight: spacing(1),
    marginBottom: spacing(1),
    maxWidth: 220,
  },
  savedText: { color: colors.text, fontSize: 13, fontWeight: '600', fontFamily, flexShrink: 1 },
  savedDelete: { color: colors.textDim, fontSize: 13, marginLeft: spacing(1) },
  resultBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing(1) },
  resultCount: { color: colors.textDim, fontSize: 13, fontWeight: '700', fontFamily },
  saveBtn: { color: colors.primary, fontSize: 13, fontWeight: '700', fontFamily },
});
