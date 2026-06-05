import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Task } from '../types';
import { radius, spacing, fontFamily, listThemes, useTheme, useThemedStyles, Palette } from '../theme';
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
  onReorderMove,
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
  /** When provided, enables drag-and-reorder (web) plus arrow-button reorder.
   *  Receives the new ordered active-id sequence. */
  onReorderMove?: (orderedActiveIds: string[]) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = listThemes[themeKey] ?? listThemes.tasks;
  const accent = accentOverride ?? theme.accent;
  const toggleComplete = useStore((s) => s.toggleComplete);
  const deleteTask = useStore((s) => s.deleteTask);
  const categories = useStore((s) => s.categories);
  const openEdit = useUI((s) => s.openEdit);
  const [hideCompleted, setHideCompleted] = useState(false);

  const reorderEnabled = !!onReorderMove;
  const dndEnabled = Platform.OS === 'web' && reorderEnabled;

  const { active, completed } = useMemo(() => {
    const a: ListItem[] = [];
    const c: ListItem[] = [];
    for (const it of items) {
      if (isOccurrenceDone(it.task, it.dateKey)) c.push(it);
      else a.push(it);
    }
    return { active: a, completed: c };
  }, [items]);

  // ---- Imperative drag state (refs, no React re-renders during drag) ----
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const tailRef = useRef<HTMLDivElement | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const dragSnapshotRef = useRef<string[]>([]);
  const overIndexRef = useRef<number | null>(null);
  const pendingOverRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const getDropEl = (idx: number | null, snap: string[]): HTMLDivElement | null => {
    if (idx === null) return null;
    if (idx >= snap.length) return tailRef.current;
    const id = snap[idx];
    return id ? rowRefs.current.get(id) ?? null : null;
  };

  const applyOverIndicator = () => {
    rafRef.current = null;
    const next = pendingOverRef.current;
    const prev = overIndexRef.current;
    const snap = dragSnapshotRef.current;
    if (next === prev) return;
    const prevEl = getDropEl(prev, snap);
    if (prevEl) prevEl.style.borderTopColor = 'transparent';
    const nextEl = getDropEl(next, snap);
    if (nextEl) nextEl.style.borderTopColor = accent;
    overIndexRef.current = next;
  };

  const queueOver = (idx: number | null) => {
    pendingOverRef.current = idx;
    if (rafRef.current === null && typeof requestAnimationFrame !== 'undefined') {
      rafRef.current = requestAnimationFrame(applyOverIndicator);
    } else if (rafRef.current === null) {
      applyOverIndicator();
    }
  };

  const resetDragVisuals = () => {
    if (rafRef.current !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const snap = dragSnapshotRef.current;
    const overEl = getDropEl(overIndexRef.current, snap);
    if (overEl) overEl.style.borderTopColor = 'transparent';
    const draggedId = dragIdRef.current;
    if (draggedId) {
      const el = rowRefs.current.get(draggedId);
      if (el) el.style.opacity = '';
    }
    dragIdRef.current = null;
    dragSnapshotRef.current = [];
    overIndexRef.current = null;
    pendingOverRef.current = null;
  };

  // Clear any pending visual state if the list changes mid-drag (defensive).
  useEffect(() => {
    return () => resetDragVisuals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computeDrop = (targetIdx: number): string[] | null => {
    const draggedId = dragIdRef.current;
    if (!draggedId || !onReorderMove) return null;
    const snap = dragSnapshotRef.current;
    const ids = [...snap];
    const dragIdx = ids.indexOf(draggedId);
    if (dragIdx < 0) return null;
    if (dragIdx === targetIdx || targetIdx === dragIdx + 1) return null;
    ids.splice(dragIdx, 1);
    const insertAt = targetIdx > dragIdx ? targetIdx - 1 : targetIdx;
    ids.splice(insertAt, 0, draggedId);
    return ids;
  };

  // Arrow-button reorder (mobile + a11y) — reuses the same `onReorderMove` path
  // so all reorder writes go through the smart `setTaskOrder` store action.
  const handleArrowMove = (taskId: string, dir: 'up' | 'down') => {
    if (!onReorderMove) return;
    const ids = active.map((a) => a.task.id);
    const idx = ids.indexOf(taskId);
    const j = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    onReorderMove(ids);
  };

  let lastGroup: string | undefined;

  const renderActiveRow = (it: ListItem, idx: number) => {
    const showGroup = it.groupLabel && it.groupLabel !== lastGroup;
    lastGroup = it.groupLabel;
    const rowKey = it.task.id + it.dateKey;
    const inner = (
      <>
        {showGroup ? <Text style={styles.group}>{it.groupLabel}</Text> : null}
        <TaskRow
          task={it.task}
          dateKey={it.dateKey}
          done={false}
          showDate={it.showDate}
          onToggle={() => toggleComplete(it.task.id, it.dateKey)}
          onPress={() => openEdit(it.task)}
          onDelete={() => deleteTask(it.task.id)}
          onMoveUp={reorderEnabled ? () => handleArrowMove(it.task.id, 'up') : undefined}
          onMoveDown={reorderEnabled ? () => handleArrowMove(it.task.id, 'down') : undefined}
          isFirst={idx === 0}
          isLast={idx === active.length - 1}
        />
      </>
    );

    if (!dndEnabled) {
      return <View key={rowKey}>{inner}</View>;
    }

    const taskId = it.task.id;

    return React.createElement(
      'div',
      {
        key: rowKey,
        draggable: true,
        ref: (el: HTMLDivElement | null) => {
          if (el) rowRefs.current.set(taskId, el);
          else rowRefs.current.delete(taskId);
        },
        onDragStart: (e: any) => {
          if (e?.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', taskId); } catch {}
          }
          dragIdRef.current = taskId;
          dragSnapshotRef.current = active.map((a) => a.task.id);
          overIndexRef.current = null;
          const el = rowRefs.current.get(taskId);
          if (el) el.style.opacity = '0.4';
        },
        onDragOver: (e: any) => {
          if (!dragIdRef.current) return;
          e.preventDefault();
          if (e?.dataTransfer) e.dataTransfer.dropEffect = 'move';
          queueOver(idx);
        },
        onDragEnd: () => resetDragVisuals(),
        onDrop: (e: any) => {
          e.preventDefault();
          const ids = computeDrop(idx);
          resetDragVisuals();
          if (ids) onReorderMove?.(ids);
        },
        style: {
          cursor: 'grab',
          borderTop: '2px solid transparent',
          // borderTopColor and opacity are mutated imperatively during drag.
        },
      },
      inner,
    );
  };

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
        {completed.length > 0 ? (
          <View style={styles.toolbar}>
            <Pressable
              onPress={() => setHideCompleted((v) => !v)}
              hitSlop={6}
              style={[styles.toggleChip, { borderColor: accent }]}
            >
              <Text style={[styles.toggleChipText, { color: accent }]}>
                {hideCompleted ? '👁  Show' : '🙈  Hide'} completed ({completed.length})
              </Text>
            </Pressable>
          </View>
        ) : null}

        {active.length === 0 && (completed.length === 0 || hideCompleted) ? (
          <EmptyState icon={emptyIcon} title={emptyTitle} subtitle={emptySubtitle} />
        ) : (
          active.map((it, idx) => renderActiveRow(it, idx))
        )}

        {/* Empty trailing drop-zone so a task can be dropped at the very end. */}
        {dndEnabled && active.length > 0 ? (
          React.createElement('div', {
            key: 'drop-tail',
            ref: (el: HTMLDivElement | null) => { tailRef.current = el; },
            onDragOver: (e: any) => {
              if (!dragIdRef.current) return;
              e.preventDefault();
              if (e?.dataTransfer) e.dataTransfer.dropEffect = 'move';
              queueOver(active.length);
            },
            onDrop: (e: any) => {
              e.preventDefault();
              const ids = computeDrop(active.length);
              resetDragVisuals();
              if (ids) onReorderMove?.(ids);
            },
            style: {
              height: 18,
              borderTop: '2px solid transparent',
            },
          })
        ) : null}

        {!hideCompleted && completed.length > 0 && (
          <View style={{ marginTop: spacing(1) }}>
            <Text style={[styles.doneTitle, { color: accent }]}>Completed {completed.length}</Text>
            {completed.map((it) => (
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

const makeStyles = (colors: Palette) => StyleSheet.create({
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
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing(1),
  },
  toggleChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.5),
    backgroundColor: colors.surface,
  },
  toggleChipText: { fontSize: 12, fontWeight: '700', fontFamily },
  doneTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily,
    paddingVertical: spacing(1),
    paddingLeft: spacing(0.5),
  },
});
