import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Task } from '../types';
import { colors, spacing, fontFamily, listThemes } from '../theme';
import { ListHeader } from './ListHeader';
import { AddTaskBar } from './AddTaskBar';
import { TaskRow } from './TaskRow';
import { EmptyState } from './ui';
import { isOccurrenceDone } from '../lib/recurrence';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';

export interface ListItem {
  task: Task;
  dateKey: string;
  showDate?: boolean;
  groupLabel?: string;
}

export function TaskListView({
  themeKey,
  icon,
  title,
  subtitle,
  items,
  emptyIcon,
  emptyTitle,
  emptySubtitle,
  addPlaceholder,
  onAdd,
  onExpand,
  accent: accentOverride,
  gradient,
  onBack,
  onReorder,
}: {
  themeKey: string;
  icon?: string;
  title: string;
  subtitle?: string;
  items: ListItem[];
  emptyIcon?: string;
  emptyTitle: string;
  emptySubtitle?: string;
  addPlaceholder?: string;
  onAdd: (title: string) => void;
  onExpand: () => void;
  accent?: string;
  gradient?: [string, string];
  onBack?: () => void;
  onReorder?: (taskId: string, dir: 'up' | 'down') => void;
}) {
  const theme = listThemes[themeKey] ?? listThemes.tasks;
  const accent = accentOverride ?? theme.accent;
  const toggleComplete = useStore((s) => s.toggleComplete);
  const deleteTask = useStore((s) => s.deleteTask);
  const categories = useStore((s) => s.categories);
  const openEdit = useUI((s) => s.openEdit);
  const [showDone, setShowDone] = useState(true);

  const { active, completed } = useMemo(() => {
    const a: ListItem[] = [];
    const c: ListItem[] = [];
    for (const it of items) {
      if (isOccurrenceDone(it.task, it.dateKey)) c.push(it);
      else a.push(it);
    }
    return { active: a, completed: c };
  }, [items]);

  let lastGroup: string | undefined;

  return (
    <View style={styles.screen}>
      <ListHeader
        themeKey={themeKey}
        icon={icon}
        title={title}
        subtitle={subtitle}
        count={active.length}
        gradient={gradient}
        onBack={onBack}
      />
      <ScrollView style={styles.body} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {active.length === 0 && completed.length === 0 ? (
          <EmptyState icon={emptyIcon} title={emptyTitle} subtitle={emptySubtitle} />
        ) : (
          active.map((it, idx) => {
            const showGroup = it.groupLabel && it.groupLabel !== lastGroup;
            lastGroup = it.groupLabel;
            return (
              <View key={it.task.id + it.dateKey}>
                {showGroup ? <Text style={styles.group}>{it.groupLabel}</Text> : null}
                <TaskRow
                  task={it.task}
                  dateKey={it.dateKey}
                  done={false}
                  showDate={it.showDate}
                  onToggle={() => toggleComplete(it.task.id, it.dateKey)}
                  onPress={() => openEdit(it.task)}
                  onDelete={() => deleteTask(it.task.id)}
                  onMoveUp={onReorder ? () => onReorder(it.task.id, 'up') : undefined}
                  onMoveDown={onReorder ? () => onReorder(it.task.id, 'down') : undefined}
                  isFirst={idx === 0}
                  isLast={idx === active.length - 1}
                />
              </View>
            );
          })
        )}

        {completed.length > 0 && (
          <View style={{ marginTop: spacing(1) }}>
            <Pressable style={styles.doneHeader} onPress={() => setShowDone((v) => !v)}>
              <Text style={[styles.doneChevron, { color: accent }]}>{showDone ? '⌄' : '›'}</Text>
              <Text style={[styles.doneTitle, { color: accent }]}>Completed {completed.length}</Text>
            </Pressable>
            {showDone &&
              completed.map((it) => (
                <TaskRow
                  key={it.task.id + it.dateKey}
                  task={it.task}
                  dateKey={it.dateKey}
                  done
                  showDate={it.showDate}
                  onToggle={() => toggleComplete(it.task.id, it.dateKey)}
                  onPress={() => openEdit(it.task)}
                  onDelete={() => deleteTask(it.task.id)}
                />
              ))}
          </View>
        )}
        <View style={{ height: spacing(2) }} />
      </ScrollView>

      <AddTaskBar accent={accent} placeholder={addPlaceholder} onAdd={onAdd} onExpand={onExpand} categories={categories} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  content: { paddingHorizontal: spacing(3), paddingTop: spacing(0.5), paddingBottom: spacing(1.5) },
  group: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    fontFamily,
    marginTop: spacing(1.5),
    marginBottom: spacing(0.5),
    marginLeft: spacing(0.5),
  },
  doneHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(1), paddingLeft: spacing(0.5) },
  doneChevron: { fontSize: 16, marginRight: spacing(1), fontWeight: '700' },
  doneTitle: { fontSize: 14, fontWeight: '700', fontFamily },
});
