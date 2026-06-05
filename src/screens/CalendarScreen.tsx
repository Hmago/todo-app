import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, PanResponder } from 'react-native';
import { radius, spacing, fontFamily, shadow, listThemes, useTheme, useThemedStyles, Palette } from '../theme';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { TaskRow } from '../components/TaskRow';
import { ListHeader } from '../components/ListHeader';
import { AddTaskBar } from '../components/AddTaskBar';
import { DayTimeline } from '../components/DayTimeline';
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
import { occursOn, isOccurrenceDone, isOccurrenceSkipped } from '../lib/recurrence';
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
  const matches = useMemo(() => {
    return (t: Task, dateKey: string) => {
      if (repeat === 'recurring' && t.recurrence === 'none' && !t.recurrenceRule) return false;
      if (repeat === 'once' && (t.recurrence !== 'none' || t.recurrenceRule)) return false;
      if (category !== 'all' && t.categoryId !== category) return false;
      const done = isOccurrenceDone(t, dateKey);
      if (status === 'completed' && !done) return false;
      if (status === 'pending' && done) return false;
      return true;
    };
  }, [status, repeat, category]);

  const exportDay = async () => {
    const items = tasks.filter((t) => occursOn(t, selected) && matches(t, selected));
    let ok = 0;
    for (const t of items) {
      const id = await exportTaskToCalendar(t, selected);
      if (id) ok++;
    }
    flash(ok > 0 ? `Exported ${ok} task${ok > 1 ? 's' : ''}` : 'Nothing to export');
    if (calPerm === 'granted') setDeviceEvents(await importDeviceEvents(selected));
  };

  const grid = useMemo(() => monthGrid(month), [month]);
  const monthIdx = month.getMonth();
  const week = useMemo(() => weekDays(fromKey(selected)), [selected]);

  const countsByDay = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {};
    const keys = view === 'week' ? week : grid.map((d) => toKey(d));
    for (const key of keys) {
      let total = 0;
      let done = 0;
      for (const t of tasks) {
        if (occursOn(t, key) && matches(t, key)) {
          total++;
          if (isOccurrenceDone(t, key)) done++;
        }
      }
      map[key] = { total, done };
    }
    return map;
  }, [grid, week, view, tasks, matches]);

  const allOnDay = useMemo(
    () =>
      tasks
        .filter((t) => occursOn(t, selected))
        .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99')),
    [tasks, selected],
  );
  const dayTasks = useMemo(() => allOnDay.filter((t) => matches(t, selected)), [allOnDay, selected, matches]);

  const summary = useMemo(() => {
    let total = 0;
    let done = 0;
    let skipped = 0;
    let recurring = 0;
    for (const t of allOnDay) {
      total++;
      if (isOccurrenceDone(t, selected)) done++;
      else if (isOccurrenceSkipped(t, selected)) skipped++;
      if (t.recurrence !== 'none' || t.recurrenceRule) recurring++;
    }
    return { total, done, skipped, pending: total - done - skipped, recurring, once: total - recurring };
  }, [allOnDay, selected]);

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
          <View style={styles.syncRow}>
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

      {view === 'day' ? (
        <DayTimeline
          dateKey={selected}
          occurrences={dayTasks}
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
              const info = countsByDay[key] ?? { total: 0, done: 0 };
              const isSel = key === selected;
              const isToday = key === todayKey();
              return (
                <Pressable key={key} onPress={() => setSelected(key)} style={styles.weekCol}>
                  <Text style={[styles.weekDow, isSel && styles.weekSelText]}>{WEEKDAYS[d.getDay()]}</Text>
                  <View style={[styles.weekDayNum, isSel && styles.weekDayNumSel, isToday && !isSel && styles.weekDayNumToday]}>
                    <Text style={[styles.weekDayNumText, isSel && styles.weekSelText]}>{d.getDate()}</Text>
                  </View>
                  {info.total > 0 ? (
                    <View style={[styles.weekDot, { backgroundColor: info.done === info.total ? colors.success : ACCENT }]} />
                  ) : (
                    <View style={styles.weekDotEmpty} />
                  )}
                </Pressable>
              );
            })}
          </View>
          <DayTimeline
            dateKey={selected}
            occurrences={dayTasks}
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
              const info = countsByDay[key] ?? { total: 0, done: 0 };
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
                      {info.total > 0 && (
                        <View
                          style={[
                            styles.dot,
                            {
                              backgroundColor: isSel
                                ? colors.white
                                : info.done === info.total
                                ? colors.success
                                : colors.primary,
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
          {dayTasks.length > 0 && <Text style={styles.dragTip}>Tip: drag the ⠿ handle onto another day to reschedule.</Text>}

          {dayTasks.length === 0 ? (
            <EmptyState
              icon="🗓️"
              title={allOnDay.length === 0 ? 'No tasks this day' : 'No tasks match filters'}
              subtitle={allOnDay.length === 0 ? undefined : 'Try adjusting the filters above'}
            />
          ) : (
            dayTasks.map((t) => (
              <DragRow key={t.id} task={t} onPickUp={pickUp} onMove={moveDrag} onDrop={dropDrag}>
                <View style={{ flex: 1 }}>
                  <TaskRow
                    task={t}
                    dateKey={selected}
                    done={isOccurrenceDone(t, selected)}
                    skipped={isOccurrenceSkipped(t, selected)}
                    onToggle={() => toggleComplete(t.id, selected)}
                    onSkip={() => toggleSkip(t.id, selected)}
                    onPress={() => openEdit(t)}
                  />
                </View>
              </DragRow>
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

function DragRow({
  task,
  onPickUp,
  onMove,
  onDrop,
  children,
}: {
  task: Task;
  onPickUp: (task: Task, x: number, y: number) => void;
  onMove: (x: number, y: number) => void;
  onDrop: (x: number, y: number) => void;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => onPickUp(task, e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderMove: (e) => onMove(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderRelease: (e) => onDrop(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderTerminate: (e) => onDrop(e.nativeEvent.pageX, e.nativeEvent.pageY),
    }),
  ).current;

  return (
    <View style={styles.dragRow}>
      {children}
      <View {...pan.panHandlers} style={styles.grip} hitSlop={8}>
        <Text style={styles.gripText}>⠿</Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing(1.5),
    paddingTop: spacing(1),
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
  dotsRow: { flexDirection: 'row', height: 8, alignItems: 'center', marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
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
  weekDot: { width: 6, height: 6, borderRadius: 3, marginTop: spacing(0.5) },
  weekDotEmpty: { width: 6, height: 6, marginTop: spacing(0.5) },
});
