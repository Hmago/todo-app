import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Task } from '../types';
import { radius, spacing, fontFamily, listThemes, useTheme, useThemedStyles, Palette } from '../theme';
import { ListHeader } from './ListHeader';
import { AddTaskBar } from './AddTaskBar';
import { TaskRow } from './TaskRow';
import { EmptyState } from './ui';
import { Tooltip } from './Tooltip';
import { occurrenceStatus } from '../lib/recurrence';
import { bucketByDate } from '../lib/buckets';
import { todayKey } from '../lib/dates';
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
  const colors = useTheme();
  const toggleComplete = useStore((s) => s.toggleComplete);
  const toggleSkip = useStore((s) => s.toggleSkip);
  const deleteTask = useStore((s) => s.deleteTask);
  const categories = useStore((s) => s.categories);
  const openEdit = useUI((s) => s.openEdit);
  const [hideCompleted, setHideCompleted] = useState(false);
  // Tracks the task occurrence whose status just flipped pending → done/skipped
  // so the newly-mounted row in the completed/skipped section can play a pop.
  const [animatingKey, setAnimatingKey] = useState<string | null>(null);
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashCompletion = (key: string) => {
    if (animTimer.current) clearTimeout(animTimer.current);
    setAnimatingKey(key);
    animTimer.current = setTimeout(() => {
      setAnimatingKey((cur) => (cur === key ? null : cur));
      animTimer.current = null;
    }, 700);
  };

  useEffect(() => {
    return () => {
      if (animTimer.current) clearTimeout(animTimer.current);
    };
  }, []);

  const reorderEnabled = !!onReorderMove;
  const dndEnabled = Platform.OS === 'web' && reorderEnabled;

  const { active, completed, skipped, completedGroups, skippedGroups } = useMemo(() => {
    const a: ListItem[] = [];
    const c: ListItem[] = [];
    const sk: ListItem[] = [];
    for (const it of items) {
      const st = occurrenceStatus(it.task, it.dateKey);
      if (st === 'completed') c.push(it);
      else if (st === 'skipped') sk.push(it);
      else a.push(it);
    }
    // Outlook-style time buckets for completed / skipped lists. The "effective
    // completion date" is the day the user actually clicked done (tracked in
    // task.completedOn); for skipped items it's just the scheduled day since
    // we don't record when the user clicked skip.
    const today = todayKey();
    const groupBy = (list: ListItem[], dateOf: (it: ListItem) => string) => {
      const groups = new Map<number, { order: number; label: string; rows: { it: ListItem; d: string }[] }>();
      for (const it of list) {
        const d = dateOf(it);
        const b = bucketByDate(d, today);
        let g = groups.get(b.order);
        if (!g) {
          g = { order: b.order, label: b.label, rows: [] };
          groups.set(b.order, g);
        }
        g.rows.push({ it, d });
      }
      return [...groups.values()]
        .sort((x, y) => x.order - y.order)
        .map((g) => ({
          order: g.order,
          label: g.label,
          items: g.rows.sort((x, y) => y.d.localeCompare(x.d)).map((r) => r.it),
        }));
    };
    return {
      active: a,
      completed: c,
      skipped: sk,
      completedGroups: groupBy(c, (it) => it.task.completedOn?.[it.dateKey] ?? it.dateKey),
      skippedGroups: groupBy(sk, (it) => it.dateKey),
    };
  }, [items]);
  const doneCount = completed.length + skipped.length;

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
  //
  // We read `active` and `onReorderMove` through refs (updated each render) so
  // that the captured closure is always referencing the latest list/callback.
  // This matters because TaskRow is wrapped in React.memo with an equality
  // function that ignores callback identity — a memoized row would otherwise
  // keep an old onMoveUp closure that calls into a stale handleArrowMove.
  const activeRef = useRef(active);
  const onReorderRef = useRef(onReorderMove);
  activeRef.current = active;
  onReorderRef.current = onReorderMove;

  const handleArrowMove = React.useCallback((taskId: string, dir: 'up' | 'down') => {
    const fn = onReorderRef.current;
    if (!fn) return;
    const ids = activeRef.current.map((a) => a.task.id);
    const idx = ids.indexOf(taskId);
    const j = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    fn(ids);
  }, []);

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
          onToggle={() => {
            flashCompletion(it.task.id + it.dateKey);
            toggleComplete(it.task.id, it.dateKey);
          }}
          onSkip={() => {
            flashCompletion(it.task.id + it.dateKey);
            toggleSkip(it.task.id, it.dateKey);
          }}
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
        {doneCount > 0 ? (
          <View style={styles.toolbar}>
            <Tooltip label={hideCompleted ? 'Show completed and skipped tasks' : 'Hide completed and skipped tasks'} placement="bottom">
              <Pressable
                onPress={() => setHideCompleted((v) => !v)}
                hitSlop={6}
                style={[styles.toggleChip, { borderColor: accent }]}
                accessibilityLabel={hideCompleted ? 'Show done tasks' : 'Hide done tasks'}
              >
                <Text style={[styles.toggleChipText, { color: accent }]}>
                  {hideCompleted ? '👁  Show' : '🙈  Hide'} done ({doneCount})
                </Text>
              </Pressable>
            </Tooltip>
          </View>
        ) : null}

        {active.length === 0 && (doneCount === 0 || hideCompleted) ? (
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
            {completedGroups.map((g) => (
              <View key={`cg-${g.order}`}>
                {completedGroups.length > 1 && (
                  <Text style={styles.doneSubgroup}>{g.label}</Text>
                )}
                {g.items.map((it) => (
                  <TaskRow
                    key={it.task.id + it.dateKey}
                    task={it.task}
                    dateKey={it.dateKey}
                    done
                    animateOnMount={animatingKey === it.task.id + it.dateKey}
                    showDate={it.showDate}
                    onToggle={() => toggleComplete(it.task.id, it.dateKey)}
                    onSkip={() => toggleSkip(it.task.id, it.dateKey)}
                    onPress={() => openEdit(it.task)}
                    onDelete={() => deleteTask(it.task.id)}
                  />
                ))}
              </View>
            ))}
          </View>
        )}

        {!hideCompleted && skipped.length > 0 && (
          <View style={{ marginTop: spacing(1) }}>
            <Text style={[styles.doneTitle, { color: colors.warning }]}>Skipped {skipped.length}</Text>
            {skippedGroups.map((g) => (
              <View key={`sg-${g.order}`}>
                {skippedGroups.length > 1 && (
                  <Text style={styles.doneSubgroup}>{g.label}</Text>
                )}
                {g.items.map((it) => (
                  <TaskRow
                    key={it.task.id + it.dateKey}
                    task={it.task}
                    dateKey={it.dateKey}
                    done={false}
                    skipped
                    animateOnMount={animatingKey === it.task.id + it.dateKey}
                    showDate={it.showDate}
                    onToggle={() => toggleComplete(it.task.id, it.dateKey)}
                    onSkip={() => toggleSkip(it.task.id, it.dateKey)}
                    onPress={() => openEdit(it.task)}
                    onDelete={() => deleteTask(it.task.id)}
                  />
                ))}
              </View>
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
  doneSubgroup: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing(1),
    marginBottom: spacing(0.25),
    marginLeft: spacing(0.5),
  },
});
