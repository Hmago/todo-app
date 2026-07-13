import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, PanResponder, Platform, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Task, Priority } from '../types';
import { radius, spacing, fontFamily, shadow, useTheme, useThemedStyles, Palette } from '../theme';
import { pretty12h, prettyDate, prettyReminder } from '../lib/dates';
import { recurrenceLabel } from '../lib/recurrence';
import { estimateLabel, estimateLevelOf, EstimateLevel } from '../lib/estimate';
import { useStore } from '../store/useStore';
import { Tooltip } from './Tooltip';

const SWIPE_THRESHOLD = 80;

function impact() {
  if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
function notify(type: Haptics.NotificationFeedbackType) {
  if (Platform.OS === 'ios') Haptics.notificationAsync(type).catch(() => {});
}

interface TaskRowProps {
  task: Task;
  dateKey: string;
  done: boolean;
  skipped?: boolean;
  showDate?: boolean;
  onToggle: () => void;
  /** Toggle the "skipped" status for this occurrence. When provided, the row
   * shows a small skip button next to the star and supports unskipping by
   * tapping the checkbox while the task is skipped. */
  onSkip?: () => void;
  onPress: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  /** Play the completion / skip pop animation when the row first mounts. Used
   * by parent lists that move tasks between active/completed/skipped sections
   * on toggle — the active row unmounts, so the new section's row gets the
   * animation flag instead. */
  animateOnMount?: boolean;
}

function TaskRowImpl({
  task,
  dateKey,
  done,
  skipped,
  showDate,
  onToggle,
  onSkip,
  onPress,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  animateOnMount,
}: TaskRowProps) {
  const styles = useThemedStyles(makeStyles);
  const colors = useTheme();
  const category = useStore((s) => s.categories.find((c) => c.id === task.categoryId));
  const toggleImportant = useStore((s) => s.toggleImportant);
  const toggleSubtask = useStore((s) => s.toggleSubtask);
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);

  const estimateLevelValue = estimateLevelOf(task.estimateMinutes);
  const estimateColor = (lvl: EstimateLevel) =>
    lvl === 'low' ? colors.success : lvl === 'medium' ? colors.warning : colors.danger;

  // Priority badge mirrors the effort badge. Medium is the default value, so we
  // only surface low / high to keep the list uncluttered.
  const showPriority = task.priority === 'low' || task.priority === 'high';
  const priorityColor = (p: Priority) =>
    p === 'low' ? colors.success : p === 'medium' ? colors.warning : colors.danger;
  const priorityLabel = (p: Priority) => p.charAt(0).toUpperCase() + p.slice(1);

  // Tapping the status circle reverts whatever state the row is currently in:
  //  pending → complete (onToggle), completed → pending (onToggle),
  //  skipped → pending (onSkip, when available).
  const handleCheck = skipped && onSkip ? onSkip : onToggle;

  // ---- Completion / skip animation ----
  // checkScale: spring-pop on the checkbox itself.
  // burstScale / burstOpacity: a soft ring that expands outward and fades.
  const checkScale = useRef(new Animated.Value(1)).current;
  const burstScale = useRef(new Animated.Value(0)).current;
  const burstOpacity = useRef(new Animated.Value(0)).current;
  const [burstColor, setBurstColor] = useState<string>(colors.primary);
  const prevDoneRef = useRef(done);
  const prevSkippedRef = useRef(!!skipped);

  const playPop = (color: string) => {
    setBurstColor(color);
    checkScale.stopAnimation();
    burstScale.stopAnimation();
    burstOpacity.stopAnimation();
    checkScale.setValue(1);
    Animated.sequence([
      Animated.spring(checkScale, { toValue: 1.35, friction: 4, tension: 120, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(checkScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
    // Start slightly larger than the check so the burst is visible from the
    // first frame (rather than growing from a hidden dot behind the check).
    burstScale.setValue(0.9);
    burstOpacity.setValue(0.6);
    Animated.parallel([
      Animated.timing(burstScale, { toValue: 2.0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(burstOpacity, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  };

  // Mount-time animation: parent (TaskListView) sets this when a task just
  // transitioned in this render cycle and was re-rendered into a different
  // section (active → completed/skipped), so the active row unmounted and
  // we wouldn't otherwise see a transition.
  useEffect(() => {
    if (animateOnMount) {
      playPop(skipped ? colors.warning : colors.primary);
    }
    // Run only on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Transition-time animation: for screens that keep the row mounted across
  // a status change (Calendar day view, Search results).
  useEffect(() => {
    const justCompleted = done && !prevDoneRef.current;
    const justSkipped = !!skipped && !prevSkippedRef.current;
    prevDoneRef.current = done;
    prevSkippedRef.current = !!skipped;
    if (justCompleted) playPop(colors.primary);
    else if (justSkipped) playPop(colors.warning);
    // colors is stable per theme; intentionally excluded from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, skipped]);

  // Cancel any in-flight animations if the row unmounts.
  useEffect(() => {
    return () => {
      checkScale.stopAnimation();
      burstScale.stopAnimation();
      burstOpacity.stopAnimation();
    };
  }, [checkScale, burstScale, burstOpacity]);

  const translateX = useRef(new Animated.Value(0)).current;
  const armed = useRef(false);

  // PanResponder is created once on mount; reading callbacks through refs (kept
  // fresh each render) prevents the swipe handler from firing a stale
  // onToggle / onSkip / onDelete when the parent passes new closures after a
  // status change, and also makes it safe for the parent to wrap the row in
  // React.memo with a callback-identity-tolerant equality.
  const handleCheckRef = useRef(handleCheck);
  const onDeleteRef = useRef(onDelete);
  handleCheckRef.current = handleCheck;
  onDeleteRef.current = onDelete;

  const reset = () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => {
        const dx = onDeleteRef.current ? g.dx : Math.max(0, g.dx); // only allow left-swipe when deletable
        translateX.setValue(dx);
        const past = Math.abs(dx) >= SWIPE_THRESHOLD;
        if (past && !armed.current) {
          armed.current = true;
          impact();
        } else if (!past && armed.current) {
          armed.current = false;
        }
      },
      onPanResponderRelease: (_e, g) => {
        armed.current = false;
        if (g.dx >= SWIPE_THRESHOLD) {
          notify(Haptics.NotificationFeedbackType.Success);
          Animated.timing(translateX, { toValue: 0, duration: 160, useNativeDriver: true }).start();
          handleCheckRef.current?.();
        } else if (g.dx <= -SWIPE_THRESHOLD && onDeleteRef.current) {
          notify(Haptics.NotificationFeedbackType.Warning);
          const fn = onDeleteRef.current;
          Animated.timing(translateX, { toValue: -500, duration: 160, useNativeDriver: true }).start(() => fn?.());
        } else {
          reset();
        }
      },
      onPanResponderTerminate: reset,
    }),
  ).current;

  // Building the meta line involves several array allocations + sort + map.
  // Memoize on task identity so an unchanged row in a re-rendering parent
  // doesn't rebuild this every time. (Task object refs are preserved by the
  // store for unchanged tasks, so this keys cleanly on `task`.)
  const meta = useMemo(() => {
    const m: string[] = [];
    const timeLabel = !task.allDay && task.time ? pretty12h(task.time) : '';
    if (showDate) m.push(prettyDate(dateKey));
    if (task.startDate && task.startDate !== task.date) m.push(`Starts ${prettyDate(task.startDate)}`);
    if (task.targetDate) {
      m.push(timeLabel ? `🎯 ${prettyDate(task.targetDate)}, ${timeLabel}` : `🎯 ${prettyDate(task.targetDate)}`);
    } else if (timeLabel) {
      m.push(timeLabel);
    }
    if (task.allDay) m.push('All-day');
    const recLabel = recurrenceLabel(task);
    if (recLabel) m.push(recLabel);
    if (task.links && task.links.length > 0) m.push(`🔗 ${task.links.length}`);
    if (task.tags && task.tags.length > 0) m.push(task.tags.map((t) => `#${t}`).join(' '));
    const reminders = task.reminders ?? [];
    if (reminders.length === 1) m.push(`🔔 ${prettyReminder(reminders[0])}`);
    else if (reminders.length > 1)
      m.push(`🔔 ${prettyReminder([...reminders].sort()[0])} +${reminders.length - 1}`);
    if (task.type === 'study') m.push('Study');
    return m;
  }, [task, showDate, dateKey]);
  const subtasks = task.subtasks ?? [];
  const subtaskDone = subtasks.filter((s) => s.done).length;

  const showReorder = !!(onMoveUp || onMoveDown);
  const isDone = done || !!skipped;
  const showSkipBtn = !!onSkip && !done && !skipped;
  const swipeLabel = isDone ? '↺  Undo' : '✓  Complete';

  const renderLevelBadge = (key: string, label: string, color: string) => (
    <View key={key} style={[styles.levelBadge, { borderColor: color }]}>
      <View style={[styles.levelDot, { backgroundColor: color }]} />
      <Text style={[styles.levelText, { color }]}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.actionLayer} pointerEvents="none">
        <View style={[styles.action, styles.completeAction]}>
          <Text style={styles.actionText}>{swipeLabel}</Text>
        </View>
        {onDelete ? (
          <View style={[styles.action, styles.deleteAction]}>
            <Text style={styles.actionText}>Delete  🗑</Text>
          </View>
        ) : (
          <View />
        )}
      </View>

      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        <View style={styles.card}>
          <Pressable onPress={onPress} style={styles.row}>
            <Tooltip
              label={
                done
                  ? 'Mark as not done'
                  : skipped
                  ? 'Mark as not skipped'
                  : 'Mark complete'
              }
            >
              <Pressable
                onPress={handleCheck}
                hitSlop={10}
                style={styles.checkHit}
                accessibilityLabel={
                  done ? 'Mark task as not done' : skipped ? 'Mark task as not skipped' : 'Mark task complete'
                }
              >
                <View style={styles.checkSlot}>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.burst,
                      {
                        backgroundColor: burstColor,
                        opacity: burstOpacity,
                        transform: [{ scale: burstScale }],
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.check,
                      done && styles.checkDone,
                      skipped && styles.checkSkipped,
                      { transform: [{ scale: checkScale }] },
                    ]}
                  >
                    {done ? (
                      <Text style={styles.checkMark}>✓</Text>
                    ) : skipped ? (
                      <Text style={styles.skipMark}>↷</Text>
                    ) : null}
                  </Animated.View>
                </View>
              </Pressable>
            </Tooltip>

            <View style={styles.body}>
              <Text
                style={[
                  styles.title,
                  done && styles.titleDone,
                  skipped && styles.titleSkipped,
                ]}
                numberOfLines={1}
              >
                {task.title}
              </Text>
              <View style={styles.metaRow}>
                {category ? (
                  <View style={styles.catWrap}>
                    <View style={[styles.catDot, { backgroundColor: category.color }]} />
                    <Text style={styles.meta}>{category.name}</Text>
                  </View>
                ) : null}
                {meta.length > 0 ? (
                  <Text style={styles.meta}>
                    {category ? '· ' : ''}
                    {meta.join(' · ')}
                  </Text>
                ) : null}
                {skipped ? (
                  <View style={[styles.statusChip, { borderColor: colors.warning, backgroundColor: 'transparent' }]}>
                    <Text style={[styles.statusChipText, { color: colors.warning }]}>Skipped</Text>
                  </View>
                ) : null}
                {showPriority
                  ? renderLevelBadge(
                      'priority',
                      `Priority - ${priorityLabel(task.priority)}`,
                      priorityColor(task.priority),
                    )
                  : null}
                {estimateLevelValue
                  ? renderLevelBadge(
                      'effort',
                      `Effort - ${estimateLabel(estimateLevelValue)}`,
                      estimateColor(estimateLevelValue),
                    )
                  : null}
                {subtasks.length > 0 ? (
                  <Pressable
                    onPress={() => setSubtasksExpanded((v) => !v)}
                    hitSlop={6}
                    style={styles.subChip}
                  >
                    <Text style={styles.subChipText}>
                      ☑ {subtaskDone}/{subtasks.length} {subtasksExpanded ? '▴' : '▾'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {showReorder ? (
              <View style={styles.reorder}>
                <Tooltip label="Move up" placement="bottom">
                  <Pressable
                    onPress={onMoveUp}
                    hitSlop={8}
                    disabled={isFirst}
                    style={styles.reorderBtn}
                    accessibilityLabel="Move task up"
                  >
                    <Text style={[styles.reorderText, isFirst && styles.reorderDisabled]}>▲</Text>
                  </Pressable>
                </Tooltip>
                <Tooltip label="Move down" placement="bottom">
                  <Pressable
                    onPress={onMoveDown}
                    hitSlop={8}
                    disabled={isLast}
                    style={styles.reorderBtn}
                    accessibilityLabel="Move task down"
                  >
                    <Text style={[styles.reorderText, isLast && styles.reorderDisabled]}>▼</Text>
                  </Pressable>
                </Tooltip>
              </View>
            ) : null}

            {showSkipBtn ? (
              <Tooltip label="Skip this occurrence">
                <Pressable onPress={onSkip} hitSlop={8} style={styles.skipHit} accessibilityLabel="Skip task">
                  <Text style={styles.skipBtn}>↷</Text>
                </Pressable>
              </Tooltip>
            ) : null}

            <Tooltip label={task.important ? 'Remove star' : 'Mark important'}>
              <Pressable
                onPress={() => toggleImportant(task.id)}
                hitSlop={10}
                style={styles.starHit}
                accessibilityLabel={task.important ? 'Remove star from task' : 'Mark task as important'}
              >
                <Text style={[styles.star, task.important && styles.starOn]}>{task.important ? '★' : '☆'}</Text>
              </Pressable>
            </Tooltip>
          </Pressable>

          {subtasksExpanded && subtasks.length > 0 ? (
            <View style={styles.subList}>
              {subtasks.map((st) => (
                <Pressable
                  key={st.id}
                  onPress={() => toggleSubtask(task.id, st.id)}
                  hitSlop={4}
                  style={styles.subItem}
                >
                  <View style={[styles.subCheck, st.done && styles.subCheckDone]}>
                    {st.done ? <Text style={styles.subCheckMark}>✓</Text> : null}
                  </View>
                  <Text
                    style={[styles.subItemText, st.done && styles.subItemTextDone]}
                    numberOfLines={2}
                  >
                    {st.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: { marginBottom: spacing(1), borderRadius: radius.md, overflow: 'hidden' },
  actionLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: radius.md,
  },
  action: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing(2) },
  completeAction: { backgroundColor: colors.primary, alignItems: 'flex-start' },
  deleteAction: { backgroundColor: colors.danger, alignItems: 'flex-end' },
  actionText: { color: colors.white, fontSize: 14, fontWeight: '800', fontFamily },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    ...shadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(1.75),
  },
  checkHit: { marginRight: spacing(1.5) },
  checkSlot: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burst: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkSkipped: { backgroundColor: colors.warning, borderColor: colors.warning },
  checkMark: { color: colors.white, fontSize: 13, fontWeight: '900', lineHeight: 15 },
  skipMark: { color: colors.white, fontSize: 14, fontWeight: '900', lineHeight: 16 },
  body: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '500', fontFamily },
  titleDone: { textDecorationLine: 'line-through', color: colors.textFaint },
  titleSkipped: { textDecorationLine: 'line-through', color: colors.textDim, fontStyle: 'italic' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
  meta: { color: colors.textDim, fontSize: 12, fontFamily },
  catWrap: { flexDirection: 'row', alignItems: 'center', marginRight: 4 },
  catDot: { width: 7, height: 7, borderRadius: 4, marginRight: 4 },
  starHit: { paddingLeft: spacing(1) },
  star: { fontSize: 19, color: colors.textFaint },
  starOn: { color: colors.star },
  skipHit: { paddingHorizontal: spacing(0.75) },
  skipBtn: { fontSize: 18, color: colors.textFaint, fontWeight: '600' },
  statusChip: {
    paddingHorizontal: spacing(0.75),
    paddingVertical: 1,
    marginLeft: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusChipText: { fontSize: 11, fontWeight: '700', fontFamily, letterSpacing: 0.2 },
  reorder: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingLeft: spacing(0.5) },
  reorderBtn: { paddingHorizontal: spacing(0.75), paddingVertical: 1 },
  reorderText: { fontSize: 12, color: colors.textDim },
  reorderDisabled: { color: colors.textFaint, opacity: 0.4 },
  subChip: {
    paddingHorizontal: spacing(0.75),
    paddingVertical: 1,
    marginLeft: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDim,
  },
  subChipText: { color: colors.primary, fontSize: 11, fontWeight: '700', fontFamily },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(0.75),
    paddingVertical: 1,
    marginLeft: 4,
    backgroundColor: 'transparent',
  },
  levelDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  levelText: { fontSize: 11, fontWeight: '700', fontFamily },
  subList: {
    paddingLeft: spacing(5.5),
    paddingRight: spacing(1.75),
    paddingBottom: spacing(1.25),
    paddingTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 2,
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(0.5),
  },
  subCheck: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(1),
  },
  subCheckDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  subCheckMark: { color: colors.white, fontSize: 11, fontWeight: '900', lineHeight: 13 },
  subItemText: { flex: 1, color: colors.text, fontSize: 13, fontFamily },
  subItemTextDone: { textDecorationLine: 'line-through', color: colors.textFaint },
});

/**
 * Custom equality for React.memo. We INTENTIONALLY ignore callback identity
 * (onToggle/onSkip/onPress/onDelete/onMoveUp/onMoveDown) and only compare
 * presence (`!!`), because the parents (TaskListView, CalendarScreen,
 * SearchScreen) pass freshly-bound closures every render that nonetheless
 * close over only stable refs (string task id + dateKey + stable Zustand
 * store actions + stable parent refs). Skipping the equality check on these
 * lets us avoid re-rendering ~all rows on every store mutation; only the
 * tasks whose `task` reference changed actually re-render.
 *
 * Invariant for callers: callbacks passed to TaskRow MUST only close over
 * values that are either (a) compared in this equality function, or (b) read
 * through a ref / stable Zustand selector. If you add a callback that closes
 * over local component state (e.g. a filter, selected date, modal mode),
 * either (i) read that state through a ref, or (ii) add the state to a prop
 * compared here so the row re-renders when it changes.
 */
function taskRowEqual(prev: TaskRowProps, next: TaskRowProps): boolean {
  return (
    prev.task === next.task &&
    prev.dateKey === next.dateKey &&
    prev.done === next.done &&
    prev.skipped === next.skipped &&
    prev.showDate === next.showDate &&
    prev.isFirst === next.isFirst &&
    prev.isLast === next.isLast &&
    prev.animateOnMount === next.animateOnMount &&
    !!prev.onSkip === !!next.onSkip &&
    !!prev.onDelete === !!next.onDelete &&
    !!prev.onMoveUp === !!next.onMoveUp &&
    !!prev.onMoveDown === !!next.onMoveDown
  );
}

export const TaskRow = React.memo(TaskRowImpl, taskRowEqual);
TaskRow.displayName = 'TaskRow';
