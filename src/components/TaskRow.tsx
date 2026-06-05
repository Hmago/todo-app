import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, PanResponder, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Task } from '../types';
import { radius, spacing, fontFamily, shadow, useTheme, useThemedStyles, Palette } from '../theme';
import { pretty12h, prettyDate, prettyReminder } from '../lib/dates';
import { recurrenceLabel } from '../lib/recurrence';
import { estimateLabel, estimateLevelOf, EstimateLevel } from '../lib/estimate';
import { useStore } from '../store/useStore';

const SWIPE_THRESHOLD = 80;

function impact() {
  if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
function notify(type: Haptics.NotificationFeedbackType) {
  if (Platform.OS === 'ios') Haptics.notificationAsync(type).catch(() => {});
}

export function TaskRow({
  task,
  dateKey,
  done,
  showDate,
  onToggle,
  onPress,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  task: Task;
  dateKey: string;
  done: boolean;
  showDate?: boolean;
  onToggle: () => void;
  onPress: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const colors = useTheme();
  const category = useStore((s) => s.categories.find((c) => c.id === task.categoryId));
  const toggleImportant = useStore((s) => s.toggleImportant);
  const toggleSubtask = useStore((s) => s.toggleSubtask);
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);

  const estimateLevelValue = estimateLevelOf(task.estimateMinutes);
  const estimateColor = (lvl: EstimateLevel) =>
    lvl === 'low' ? colors.success : lvl === 'medium' ? colors.warning : colors.danger;

  const translateX = useRef(new Animated.Value(0)).current;
  const armed = useRef(false);

  const reset = () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => {
        const dx = onDelete ? g.dx : Math.max(0, g.dx); // only allow left-swipe when deletable
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
          onToggle();
        } else if (g.dx <= -SWIPE_THRESHOLD && onDelete) {
          notify(Haptics.NotificationFeedbackType.Warning);
          Animated.timing(translateX, { toValue: -500, duration: 160, useNativeDriver: true }).start(() => onDelete());
        } else {
          reset();
        }
      },
      onPanResponderTerminate: reset,
    }),
  ).current;

  const meta: string[] = [];
  if (showDate) meta.push(prettyDate(task.date));
  if (task.startDate && task.startDate !== task.date) meta.push(`Starts ${prettyDate(task.startDate)}`);
  if (task.allDay) meta.push('All-day');
  else if (task.time) meta.push(pretty12h(task.time));
  const recLabel = recurrenceLabel(task);
  if (recLabel) meta.push(recLabel);
  const subtasks = task.subtasks ?? [];
  const subtaskDone = subtasks.filter((s) => s.done).length;
  if (task.links && task.links.length > 0) meta.push(`🔗 ${task.links.length}`);
  if (task.tags && task.tags.length > 0) meta.push(task.tags.map((t) => `#${t}`).join(' '));
  const reminders = task.reminders ?? [];
  if (reminders.length === 1) meta.push(`🔔 ${prettyReminder(reminders[0])}`);
  else if (reminders.length > 1)
    meta.push(`🔔 ${prettyReminder([...reminders].sort()[0])} +${reminders.length - 1}`);
  if (task.type === 'study') meta.push('Study');

  const showReorder = !!(onMoveUp || onMoveDown);

  return (
    <View style={styles.wrap}>
      <View style={styles.actionLayer} pointerEvents="none">
        <View style={[styles.action, styles.completeAction]}>
          <Text style={styles.actionText}>{done ? '↺  Undo' : '✓  Complete'}</Text>
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
            <Pressable onPress={onToggle} hitSlop={10} style={styles.checkHit}>
              <View style={[styles.check, done && styles.checkDone]}>
                {done && <Text style={styles.checkMark}>✓</Text>}
              </View>
            </Pressable>

            <View style={styles.body}>
              <Text style={[styles.title, done && styles.titleDone]} numberOfLines={1}>
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
                {estimateLevelValue ? (
                  <View
                    style={[
                      styles.estimateBadge,
                      { borderColor: estimateColor(estimateLevelValue) },
                    ]}
                  >
                    <View
                      style={[
                        styles.estimateDot,
                        { backgroundColor: estimateColor(estimateLevelValue) },
                      ]}
                    />
                    <Text
                      style={[
                        styles.estimateText,
                        { color: estimateColor(estimateLevelValue) },
                      ]}
                    >
                      {estimateLabel(estimateLevelValue)}
                    </Text>
                  </View>
                ) : null}
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
                <Pressable onPress={onMoveUp} hitSlop={8} disabled={isFirst} style={styles.reorderBtn}>
                  <Text style={[styles.reorderText, isFirst && styles.reorderDisabled]}>▲</Text>
                </Pressable>
                <Pressable onPress={onMoveDown} hitSlop={8} disabled={isLast} style={styles.reorderBtn}>
                  <Text style={[styles.reorderText, isLast && styles.reorderDisabled]}>▼</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable onPress={() => toggleImportant(task.id)} hitSlop={10} style={styles.starHit}>
              <Text style={[styles.star, task.important && styles.starOn]}>{task.important ? '★' : '☆'}</Text>
            </Pressable>
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
  checkMark: { color: colors.white, fontSize: 13, fontWeight: '900', lineHeight: 15 },
  body: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '500', fontFamily },
  titleDone: { textDecorationLine: 'line-through', color: colors.textFaint },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
  meta: { color: colors.textDim, fontSize: 12, fontFamily },
  catWrap: { flexDirection: 'row', alignItems: 'center', marginRight: 4 },
  catDot: { width: 7, height: 7, borderRadius: 4, marginRight: 4 },
  starHit: { paddingLeft: spacing(1) },
  star: { fontSize: 19, color: colors.textFaint },
  starOn: { color: colors.star },
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
  estimateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(0.75),
    paddingVertical: 1,
    marginLeft: 4,
    backgroundColor: 'transparent',
  },
  estimateDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  estimateText: { fontSize: 11, fontWeight: '700', fontFamily },
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
