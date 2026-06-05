import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, PanResponder } from 'react-native';
import { radius, spacing, fontFamily, shadow, listThemes, useTheme, useThemedStyles, Palette } from '../theme';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { TaskRow } from '../components/TaskRow';
import { ListHeader } from '../components/ListHeader';
import { AddTaskBar } from '../components/AddTaskBar';
import { DayTimeline, TimelineOccurrence } from '../components/DayTimeline';
import { Button, EmptyState, SectionTitle, Chip } from '../components/ui';
import { Task } from '../types';
import {
  monthGrid,
  prettyMonth,
  prettyWeekRange,
  prettyDayLong,
  addMonths,
  toKey,
  fromKey,
  todayKey,
  prettyDate,
  rollReminderToDate,
  shiftDateKey,
  weekDays,
  startOfMonth,
} from '../lib/dates';
import { occursOn, occurrenceStatus } from '../lib/recurrence';
import {
  calendarSyncSupported,
  getCalendarPermission,
  requestCalendarPermission,
  importDeviceEvents,
  exportTaskToCalendar,
  DeviceEvent,
  CalendarPermission,
} from '../lib/calendarSync';
import { quickAddToTask } from '../lib/quickAdd';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type ViewMode = 'month' | 'week' | 'day';
type StatusFilter = 'all' | 'pending' | 'completed';
type RepeatFilter = 'all' | 'recurring' | 'once';

// A unified per-day item. `displayDate` is the day this item shows up on:
// - for pending/skipped: same as scheduledDate
// - for completed: t.completedOn[scheduledDate] ?? scheduledDate (the day the
//   user actually marked it done). This means a task scheduled on the 5th but
//   ticked off on the 6th appears on the 6th, while still routing toggles to
//   its original scheduled occurrence record (scheduledDate=5).
type OccurrenceStatus = 'pending' | 'completed' | 'skipped';
interface DayItem {
  task: Task;
  scheduledDate: string;
  displayDate: string;
  status: OccurrenceStatus;
}

const ACCENT = listThemes.calendar.accent;

export function CalendarScreen({ onBack }: { onBack?: () => void }) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [view, setView] = useState<ViewMode>('month');
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selected, setSelected] = useState(todayKey());
  const [status, setStatus] = useState<StatusFilter>('all');
  const [repeat, setRepeat] = useState<RepeatFilter>('all');
  const [category, setCategory] = useState<string>('all');

  const tasks = useStore((s) => s.tasks);
  const categories = useStore((s) => s.categories);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const toggleComplete = useStore((s) => s.toggleComplete);
  const toggleSkip = useStore((s) => s.toggleSkip);
  const openEdit = useUI((s) => s.openEdit);
  const openNew = useUI((s) => s.openNew);

  // ----- device calendar sync -----
  const calSupported = calendarSyncSupported();
  const [calPerm, setCalPerm] = useState<CalendarPermission>('default');
  const [deviceEvents, setDeviceEvents] = useState<DeviceEvent[]>([]);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const flash = (m: string) => {
    setSyncMsg(m);
    setTimeout(() => setSyncMsg((cur) => (cur === m ? null : cur)), 2500);
  };

  useEffect(() => {
    if (!calSupported) return;
    getCalendarPermission().then(setCalPerm);
  }, [calSupported]);

  useEffect(() => {
    let cancel = false;
    if (calSupported && calPerm === 'granted') {
      importDeviceEvents(selected).then((evs) => {
        if (!cancel) setDeviceEvents(evs);
      });
    } else {
      setDeviceEvents([]);
    }
    return () => {
      cancel = true;
    };
  }, [calSupported, calPerm, selected, tasks]);

  const enableSync = async () => {
    const p = await requestCalendarPermission();
    setCalPerm(p);
    if (p === 'granted') {
      setDeviceEvents(await importDeviceEvents(selected));
      flash('Calendar connected');
    } else {
      flash('Calendar permission denied');
    }
  };

  // ----- filtering -----
  // Repeat + category filter only; the status filter is applied to DayItem
  // values further down because it needs to inspect each item's status.
  const repeatCatMatches = useMemo(() => {
    return (t: Task) => {
      if (repeat === 'recurring' && t.recurrence === 'none' && !t.recurrenceRule) return false;
      if (repeat === 'once' && (t.recurrence !== 'none' || t.recurrenceRule)) return false;
      if (category !== 'all' && t.categoryId !== category) return false;
      return true;
    };
  }, [repeat, category]);

  const statusMatches = (s: OccurrenceStatus) => {
    if (status === 'all') return true;
    if (status === 'completed') return s === 'completed';
    // 'pending' filter excludes skipped, matching the summary chip's meaning.
    return s === 'pending';
  };

  const grid = useMemo(() => monthGrid(month), [month]);
  const monthIdx = month.getMonth();
  const week = useMemo(() => weekDays(fromKey(selected)), [selected]);

  // ----- per-day items, routed by completion day -----
  //
  // For every visible day key, we build the list of items that should appear
  // there. Pending/skipped occurrences route to their scheduledDate; completed
  // occurrences route to their actual completion day (`completedOn` map),
  // falling back to scheduledDate for legacy entries.
  //
  // The visible-key set covers the month grid, the current week strip, and the
  // selected day, so day/week/month views all read from this same map.
  const visibleKeySet = useMemo(() => {
    const s = new Set<string>();
    for (const d of grid) s.add(toKey(d));
    for (const k of week) s.add(k);
    s.add(selected);
    return s;
  }, [grid, week, selected]);

  const itemsByDay = useMemo(() => {
    const map: Record<string, DayItem[]> = {};
    const push = (day: string, item: DayItem) => {
      if (!visibleKeySet.has(day)) return;
      (map[day] ?? (map[day] = [])).push(item);
    };

    for (const t of tasks) {
      if (!repeatCatMatches(t)) continue;

      // Completed occurrences: place each one on its actual completion day.
      // We walk completedDates so we still surface historical completions
      // even when the task no longer "occursOn" the original scheduled day
      // (e.g., a one-time task whose date was edited afterwards).
      for (const sched of t.completedDates) {
        const displayDate = t.completedOn?.[sched] ?? sched;
        push(displayDate, { task: t, scheduledDate: sched, displayDate, status: 'completed' });
      }

      // Pending / skipped occurrences: walk every visible key and ask whether
      // the task occurs on that day. Skip completed ones here — they were
      // already emitted above under their actual completion day.
      for (const key of visibleKeySet) {
        if (!occursOn(t, key)) continue;
        const st = occurrenceStatus(t, key);
        if (st === 'completed') continue;
        push(key, { task: t, scheduledDate: key, displayDate: key, status: st });
      }
    }

    // Stable sort: pending first by scheduled time, then completed by
    // completion time, then alphabetical tiebreak.
    const itemTime = (it: DayItem) => {
      if (it.status === 'completed') {
        return `2_${it.task.completedTimes?.[it.scheduledDate] ?? '99:99'}`;
      }
      return `1_${it.task.time ?? '99:99'}`;
    };
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => itemTime(a).localeCompare(itemTime(b)) || a.task.title.localeCompare(b.task.title));
    }
    return map;
  }, [tasks, repeatCatMatches, visibleKeySet]);

  // Counts per day used by dots and the summary chip. Ignores the status
  // filter so toggling "Completed only" doesn't change how many dots a day
  // shows — repeat/category filters still apply via repeatCatMatches.
  const countsByDay = useMemo(() => {
    const map: Record<string, { total: number; done: number; pending: number; skipped: number }> = {};
    for (const key of visibleKeySet) {
      const items = itemsByDay[key] ?? [];
      let done = 0;
      let pending = 0;
      let skipped = 0;
      for (const it of items) {
        if (it.status === 'completed') done++;
        else if (it.status === 'skipped') skipped++;
        else pending++;
      }
      map[key] = { total: items.length, done, pending, skipped };
    }
    return map;
  }, [itemsByDay, visibleKeySet]);

  // Items on the selected day after the status filter — what's actually shown.
  const dayItems = useMemo(() => {
    const items = itemsByDay[selected] ?? [];
    return items.filter((it) => statusMatches(it.status));
  }, [itemsByDay, selected, status]);

  const summary = useMemo(() => {
    const c = countsByDay[selected] ?? { total: 0, done: 0, pending: 0, skipped: 0 };
    let recurring = 0;
    for (const it of itemsByDay[selected] ?? []) {
      if (it.task.recurrence !== 'none' || it.task.recurrenceRule) recurring++;
    }
    return { ...c, recurring, once: c.total - recurring };
  }, [countsByDay, itemsByDay, selected]);

  // Timeline shape used by DayTimeline (day + week views).
  const dayTimelineOccurrences = useMemo<TimelineOccurrence[]>(
    () => dayItems.map((it) => ({ task: it.task, scheduledDate: it.scheduledDate })),
    [dayItems],
  );

  const exportDay = async () => {
    // Only export items scheduled for the selected day — pulling completed
    // entries from other scheduled dates would create duplicate events on
    // the wrong day.
    const items = (itemsByDay[selected] ?? []).filter(
      (it) => it.scheduledDate === selected && statusMatches(it.status),
    );
    let ok = 0;
    for (const it of items) {
      const id = await exportTaskToCalendar(it.task, it.scheduledDate);
      if (id) ok++;
    }
    flash(ok > 0 ? `Exported ${ok} task${ok > 1 ? 's' : ''}` : 'Nothing to export');
    if (calPerm === 'granted') setDeviceEvents(await importDeviceEvents(selected));
  };

  // ----- navigation -----
  const goPrev = () => {
    if (view === 'month') setMonth(addMonths(month, -1));
    else if (view === 'week') setSelected(shiftDateKey(selected, -7));
    else setSelected(shiftDateKey(selected, -1));
  };
  const goNext = () => {
    if (view === 'month') setMonth(addMonths(month, 1));
    else if (view === 'week') setSelected(shiftDateKey(selected, 7));
    else setSelected(shiftDateKey(selected, 1));
  };
  const goToday = () => {
    setMonth(startOfMonth(new Date()));
    setSelected(todayKey());
  };
  const navLabel =
    view === 'month'
      ? prettyMonth(month)
      : view === 'week'
      ? prettyWeekRange(fromKey(selected))
      : prettyDayLong(selected);

  const reschedule = (taskId: string, newKey: string) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t || t.date === newKey) return;
    const reminders = t.reminders?.length ? t.reminders.map((r) => rollReminderToDate(r, newKey)) : t.reminders;
    updateTask(taskId, { date: newKey, reminders });
    setSelected(newKey);
    flash(`Moved to ${prettyDate(newKey)}`);
  };

  // ----- drag-to-reschedule (month view) -----
  const gridRef = useRef<View>(null);
  const gridRectRef = useRef<{ x: number; y: number; w: number; h: number; rows: number } | null>(null);
  const dragTaskRef = useRef<string | null>(null);
  const [drag, setDrag] = useState<{ title: string; x: number; y: number; hoverKey: string | null } | null>(null);

  const keyAt = (px: number, py: number): string | null => {
    const r = gridRectRef.current;
    if (!r) return null;
    if (px < r.x || px > r.x + r.w || py < r.y || py > r.y + r.h) return null;
    const col = Math.min(6, Math.max(0, Math.floor(((px - r.x) / r.w) * 7)));
    const row = Math.min(r.rows - 1, Math.max(0, Math.floor(((py - r.y) / r.h) * r.rows)));
    const idx = row * 7 + col;
    return grid[idx] ? toKey(grid[idx]) : null;
  };

  const pickUp = (task: Task, px: number, py: number) => {
    dragTaskRef.current = task.id;
    gridRef.current?.measureInWindow((x, y, w, h) => {
      gridRectRef.current = { x, y, w, h, rows: grid.length / 7 };
    });
    setDrag({ title: task.title, x: px, y: py, hoverKey: null });
  };
  const moveDrag = (px: number, py: number) => {
    setDrag((d) => (d ? { ...d, x: px, y: py, hoverKey: keyAt(px, py) } : d));
  };
  const dropDrag = (px: number, py: number) => {
    const id = dragTaskRef.current;
    const target = keyAt(px, py);
    if (id && target) reschedule(id, target);
    dragTaskRef.current = null;
    setDrag(null);
  };

  return (
    <View style={styles.screen}>
      <ListHeader themeKey="calendar" icon="📅" title="Calendar" subtitle={navLabel} onBack={onBack} />

      <View style={styles.toolbar}>
        <View style={styles.segment}>
          {(['month', 'week', 'day'] as ViewMode[]).map((m) => (
            <Pressable key={m} onPress={() => setView(m)} style={[styles.segBtn, view === m && styles.segBtnActive]}>
              <Text style={[styles.segText, view === m && styles.segTextActive]}>
                {m[0].toUpperCase() + m.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        {calSupported && (
          <View style={[styles.syncRow, { marginLeft: 'auto' }]}>
            {calPerm === 'granted' ? (
              <Button title="Export day" small variant="ghost" onPress={exportDay} />
            ) : (
              <Button title="📅 Sync" small variant="ghost" onPress={enableSync} />
            )}
          </View>
        )}
      </View>
      {syncMsg && <Text style={styles.syncMsg}>{syncMsg}</Text>}

      <View style={styles.navRow}>
        <Pressable onPress={goPrev} style={styles.navBtn}>
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Pressable onPress={goToday}>
          <Text style={styles.navLabel}>{navLabel}</Text>
        </Pressable>
        <Pressable onPress={goNext} style={styles.navBtn}>
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryDate}>{prettyDate(selected)}</Text>
        <View style={styles.summaryChips}>
          <View style={styles.summaryChip}>
            <View style={[styles.summaryDot, { backgroundColor: colors.success }]} />
            <Text style={styles.summaryText}>
              <Text style={styles.summaryNum}>{summary.done}</Text> done
            </Text>
          </View>
          <View style={styles.summaryChip}>
            <View style={[styles.summaryDot, { backgroundColor: ACCENT }]} />
            <Text style={styles.summaryText}>
              <Text style={styles.summaryNum}>{summary.pending}</Text> pending
            </Text>
          </View>
          {summary.skipped > 0 ? (
            <View style={styles.summaryChip}>
              <View style={[styles.summaryDot, { backgroundColor: colors.warning }]} />
              <Text style={styles.summaryText}>
                <Text style={styles.summaryNum}>{summary.skipped}</Text> skipped
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {view === 'day' ? (
        <DayTimeline
          dateKey={selected}
          occurrences={dayTimelineOccurrences}
          deviceEvents={deviceEvents}
          onPressTask={openEdit}
          onCreateAt={() => openNew({ date: selected, categoryId: category !== 'all' ? category : undefined })}
          accent={ACCENT}
        />
      ) : view === 'week' ? (
        <View style={{ flex: 1 }}>
          <View style={styles.weekStrip}>
            {week.map((key) => {
              const d = fromKey(key);
              const info = countsByDay[key] ?? { total: 0, done: 0, pending: 0, skipped: 0 };
              const isSel = key === selected;
              const isToday = key === todayKey();
              return (
                <Pressable key={key} onPress={() => setSelected(key)} style={styles.weekCol}>
                  <Text style={[styles.weekDow, isSel && styles.weekSelText]}>{WEEKDAYS[d.getDay()]}</Text>
                  <View style={[styles.weekDayNum, isSel && styles.weekDayNumSel, isToday && !isSel && styles.weekDayNumToday]}>
                    <Text style={[styles.weekDayNumText, isSel && styles.weekSelText]}>{d.getDate()}</Text>
                  </View>
                  <View style={styles.weekDotRow}>
                    {info.done > 0 ? (
                      <View style={[styles.weekDot, { backgroundColor: colors.success }]} />
                    ) : null}
                    {info.pending > 0 ? (
                      <View style={[styles.weekDot, { backgroundColor: ACCENT }]} />
                    ) : null}
                    {info.done === 0 && info.pending === 0 ? <View style={styles.weekDotEmpty} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <DayTimeline
            dateKey={selected}
            occurrences={dayTimelineOccurrences}
            deviceEvents={deviceEvents}
            onPressTask={openEdit}
            onCreateAt={() => openNew({ date: selected, categoryId: category !== 'all' ? category : undefined })}
            accent={ACCENT}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={styles.weekday}>
                {w}
              </Text>
            ))}
          </View>

          <View ref={gridRef} style={styles.grid} collapsable={false}>
            {grid.map((d) => {
              const key = toKey(d);
              const info = countsByDay[key] ?? { total: 0, done: 0, pending: 0, skipped: 0 };
              const inMonth = d.getMonth() === monthIdx;
              const isSel = key === selected;
              const isToday = key === todayKey();
              const isHover = drag?.hoverKey === key;
              return (
                <Pressable key={key} onPress={() => setSelected(key)} style={styles.cellWrap}>
                  <View style={[styles.cell, isSel && styles.cellSel, isToday && !isSel && styles.cellToday, isHover && styles.cellHover]}>
                    <Text style={[styles.cellNum, !inMonth && styles.cellMuted, isSel && styles.cellNumSel]}>
                      {d.getDate()}
                    </Text>
                    <View style={styles.dotsRow}>
                      {info.done > 0 && (
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: isSel ? colors.white : colors.success },
                          ]}
                        />
                      )}
                      {info.pending > 0 && (
                        <View
                          style={[
                            styles.dot,
                            {
                              backgroundColor: isSel ? colors.white : colors.primary,
                              opacity: isSel ? 0.6 : 1,
                            },
                          ]}
                        />
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {drag && (
            <Text style={styles.dragHint}>
              Drop on a day to reschedule{drag.hoverKey ? ` → ${prettyDate(drag.hoverKey)}` : ''}
            </Text>
          )}

          <Text style={styles.filterLabel}>Status</Text>
          <View style={styles.filterRow}>
            <Chip label="All" active={status === 'all'} onPress={() => setStatus('all')} />
            <Chip label={`Pending${summary.pending ? ` · ${summary.pending}` : ''}`} color={colors.primary} active={status === 'pending'} onPress={() => setStatus('pending')} />
            <Chip label={`Completed${summary.done ? ` · ${summary.done}` : ''}`} color={colors.success} active={status === 'completed'} onPress={() => setStatus('completed')} />
          </View>

          <Text style={styles.filterLabel}>Repeat</Text>
          <View style={styles.filterRow}>
            <Chip label="All" active={repeat === 'all'} onPress={() => setRepeat('all')} />
            <Chip label={`Recurring${summary.recurring ? ` · ${summary.recurring}` : ''}`} color={ACCENT} active={repeat === 'recurring'} onPress={() => setRepeat('recurring')} />
            <Chip label={`One-time${summary.once ? ` · ${summary.once}` : ''}`} active={repeat === 'once'} onPress={() => setRepeat('once')} />
          </View>

          {categories.length > 0 && (
            <>
              <Text style={styles.filterLabel}>Category</Text>
              <View style={styles.filterRow}>
                <Chip label="All" active={category === 'all'} onPress={() => setCategory('all')} />
                {categories.map((c) => (
                  <Chip key={c.id} label={c.name} color={c.color} active={category === c.id} onPress={() => setCategory(c.id)} />
                ))}
              </View>
            </>
          )}

          <SectionTitle right={<Button title="+ Add" small onPress={() => openNew({ date: selected, categoryId: category !== 'all' ? category : undefined })} />}>
            {prettyDate(selected)}
          </SectionTitle>
          {dayItems.some((it) => it.scheduledDate === selected && it.status !== 'completed') ? (
            <Text style={styles.dragTip}>Tip: drag the ⠿ handle onto another day to reschedule.</Text>
          ) : null}

          {dayItems.length === 0 ? (
            <EmptyState
              icon="🗓️"
              title={(itemsByDay[selected]?.length ?? 0) === 0 ? 'No tasks this day' : 'No tasks match filters'}
              subtitle={(itemsByDay[selected]?.length ?? 0) === 0 ? undefined : 'Try adjusting the filters above'}
            />
          ) : (
            dayItems.map((it) => (
              <DayItemRow
                key={`${it.task.id}|${it.scheduledDate}|${it.status}`}
                item={it}
                selected={selected}
                draggable={it.scheduledDate === selected && it.status !== 'completed'}
                onPickUp={pickUp}
                onMove={moveDrag}
                onDrop={dropDrag}
                onToggle={() => toggleComplete(it.task.id, it.scheduledDate)}
                onSkip={() => toggleSkip(it.task.id, it.scheduledDate)}
                onPress={() => openEdit(it.task)}
              />
            ))
          )}
          <View style={{ height: spacing(2) }} />
        </ScrollView>
      )}

      {view === 'month' && (
        <AddTaskBar
          accent={ACCENT}
          placeholder={`Add a task on ${prettyDate(selected)}`}
          categories={categories}
          onAdd={(title) =>
            addTask(
              quickAddToTask(
                title,
                { date: selected, type: 'task', categoryId: category !== 'all' ? category : undefined },
                categories,
              ),
            )
          }
          onExpand={() => openNew({ date: selected, categoryId: category !== 'all' ? category : undefined })}
        />
      )}

      {drag && (
        <View pointerEvents="none" style={[styles.dragGhost, { left: drag.x + 12, top: drag.y - 16 }]}>
          <Text style={styles.dragGhostText} numberOfLines={1}>
            {drag.title}
          </Text>
        </View>
      )}
    </View>
  );
}

// Single row used by the month-view day list. Wraps a TaskRow and, when the
// item is scheduled for the displayed day and not completed, attaches a drag
// handle so it can be moved to another day on the month grid. Completed
// occurrences from other scheduled dates render with a "was scheduled X" note
// instead of a drag handle, since rescheduling a finished item is ambiguous.
function DayItemRow({
  item,
  selected,
  draggable,
  onPickUp,
  onMove,
  onDrop,
  onToggle,
  onSkip,
  onPress,
}: {
  item: DayItem;
  selected: string;
  draggable: boolean;
  onPickUp: (task: Task, x: number, y: number) => void;
  onMove: (x: number, y: number) => void;
  onDrop: (x: number, y: number) => void;
  onToggle: () => void;
  onSkip: () => void;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => draggable,
      onMoveShouldSetPanResponder: () => draggable,
      onPanResponderGrant: (e) => onPickUp(item.task, e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderMove: (e) => onMove(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderRelease: (e) => onDrop(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderTerminate: (e) => onDrop(e.nativeEvent.pageX, e.nativeEvent.pageY),
    }),
  ).current;

  const offset = item.scheduledDate !== selected;
  const time =
    item.status === 'completed' ? item.task.completedTimes?.[item.scheduledDate] : undefined;
  const note =
    item.status === 'completed' && (offset || time)
      ? `${time ? `Done at ${time}` : 'Completed'}${
          offset ? ` · was scheduled ${prettyDate(item.scheduledDate)}` : ''
        }`
      : null;

  return (
    <View>
      {note ? <Text style={styles.completedNote}>{note}</Text> : null}
      <View style={styles.dragRow}>
        <View style={{ flex: 1 }}>
          <TaskRow
            task={item.task}
            dateKey={item.scheduledDate}
            done={item.status === 'completed'}
            skipped={item.status === 'skipped'}
            onToggle={onToggle}
            onSkip={onSkip}
            onPress={onPress}
          />
        </View>
        {draggable ? (
          <View {...pan.panHandlers} style={styles.grip} hitSlop={8}>
            <Text style={styles.gripText}>⠿</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const CELL = `${100 / 7}%`;

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(1.5) },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    paddingHorizontal: spacing(1.5),
    paddingTop: spacing(1),
    gap: spacing(1),
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 2,
  },
  segBtn: { paddingVertical: spacing(0.5), paddingHorizontal: spacing(1.75), borderRadius: radius.pill },
  segBtnActive: { backgroundColor: ACCENT },
  segText: { color: colors.textDim, fontSize: 13, fontWeight: '600', fontFamily },
  segTextActive: { color: colors.white, fontWeight: '700' },
  syncRow: { flexDirection: 'row', alignItems: 'center' },
  completedNote: {
    color: colors.textFaint,
    fontSize: 11,
    fontFamily,
    fontWeight: '600',
    marginLeft: spacing(4),
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  syncMsg: { color: ACCENT, fontSize: 12, textAlign: 'center', paddingTop: spacing(0.5), fontFamily },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  navText: { color: colors.text, fontSize: 22, fontWeight: '700' },
  navLabel: { color: colors.text, fontSize: 17, fontWeight: '700', fontFamily },
  weekRow: { flexDirection: 'row', marginBottom: spacing(0.5) },
  weekday: { color: colors.textDim, width: CELL as any, textAlign: 'center', fontWeight: '700', fontSize: 12, fontFamily },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing(1) },
  cellWrap: { width: CELL as any, aspectRatio: 1, padding: 2 },
  cell: {
    flex: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  cellToday: { borderColor: colors.primary },
  cellHover: { borderColor: ACCENT, borderWidth: 2, backgroundColor: ACCENT + '22' },
  cellNum: { color: colors.text, fontSize: 14, fontWeight: '600', fontFamily },
  cellNumSel: { color: colors.white, fontWeight: '800' },
  cellMuted: { color: colors.textFaint },
  dotsRow: { flexDirection: 'row', height: 8, alignItems: 'center', marginTop: 2, gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: spacing(1.5),
    paddingBottom: spacing(1),
    gap: spacing(1),
  },
  summaryDate: { color: colors.textDim, fontSize: 12, fontWeight: '700', fontFamily, letterSpacing: 0.3, textTransform: 'uppercase' },
  summaryChips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing(0.75) },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.25),
  },
  summaryDot: { width: 7, height: 7, borderRadius: 4, marginRight: spacing(0.625) },
  summaryText: { color: colors.textDim, fontSize: 12, fontFamily, fontWeight: '500' },
  summaryNum: { color: colors.text, fontWeight: '800' },
  weekDotRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing(0.5), gap: 3, height: 6 },
  filterLabel: { color: colors.textDim, fontSize: 12, fontWeight: '700', fontFamily, marginTop: spacing(1), marginBottom: spacing(0.5), textTransform: 'uppercase', letterSpacing: 0.5 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap' },
  dragTip: { color: colors.textFaint, fontSize: 11, marginBottom: spacing(1), fontFamily },
  dragHint: { color: ACCENT, fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: spacing(1), fontFamily },
  dragRow: { flexDirection: 'row', alignItems: 'center' },
  grip: { paddingHorizontal: spacing(1), paddingVertical: spacing(1), marginBottom: spacing(1), alignSelf: 'stretch', justifyContent: 'center' },
  gripText: { color: colors.textFaint, fontSize: 18 },
  dragGhost: {
    position: 'absolute',
    backgroundColor: ACCENT,
    borderRadius: radius.md,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.75),
    maxWidth: 220,
    ...shadow,
  },
  dragGhostText: { color: colors.white, fontWeight: '700', fontSize: 13, fontFamily },
  weekStrip: {
    flexDirection: 'row',
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(0.5),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekCol: { flex: 1, alignItems: 'center' },
  weekDow: { color: colors.textDim, fontSize: 11, fontWeight: '700', marginBottom: spacing(0.5), fontFamily },
  weekDayNum: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  weekDayNumSel: { backgroundColor: colors.primary },
  weekDayNumToday: { borderWidth: 1, borderColor: colors.primary },
  weekDayNumText: { color: colors.text, fontSize: 15, fontWeight: '700', fontFamily },
  weekSelText: { color: colors.white },
  weekDot: { width: 6, height: 6, borderRadius: 3 },
  weekDotEmpty: { width: 6, height: 6 },
});
