import React, { useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Task } from '../types';
import { DeviceEvent } from '../lib/calendarSync';
import { radius, spacing, fontFamily, useTheme, useThemedStyles, Palette } from '../theme';
import { minutesOfDay, pretty12h, prettyDuration, todayKey } from '../lib/dates';
import { useStore } from '../store/useStore';
import { isOccurrenceDone } from '../lib/recurrence';

const HOUR_HEIGHT = 56;
const GUTTER = 52;
const DAY_START_HOUR = 0;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface Block {
  id: string;
  title: string;
  startMin: number;
  endMin: number;
  kind: 'task' | 'event';
  task?: Task;
  color: string;
  done?: boolean;
  lane: number;
  lanes: number;
}

function hourLabel(h: number): string {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

/** Greedy lane packing so overlapping blocks sit side-by-side. */
function packLanes(blocks: Omit<Block, 'lane' | 'lanes'>[]): Block[] {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const laneEnds: number[] = [];
  const placed: (Block & { _group: number })[] = [];
  let groupStart = -Infinity;
  let groupEnd = -Infinity;
  let groupItems: (Block & { _group: number })[] = [];
  let groupId = 0;

  const flush = () => {
    const lanesUsed = Math.max(1, ...groupItems.map((g) => g.lane + 1));
    groupItems.forEach((g) => (g.lanes = lanesUsed));
  };

  for (const b of sorted) {
    if (b.startMin >= groupEnd) {
      if (groupItems.length) flush();
      laneEnds.length = 0;
      groupItems = [];
      groupId++;
      groupStart = b.startMin;
    }
    groupStart = Math.min(groupStart, b.startMin);
    groupEnd = Math.max(groupEnd, b.endMin);
    let lane = laneEnds.findIndex((end) => end <= b.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(b.endMin);
    } else {
      laneEnds[lane] = b.endMin;
    }
    const item = { ...b, lane, lanes: 1, _group: groupId } as Block & { _group: number };
    groupItems.push(item);
    placed.push(item);
  }
  if (groupItems.length) flush();
  return placed;
}

export function DayTimeline({
  dateKey,
  occurrences,
  deviceEvents,
  onPressTask,
  onCreateAt,
  accent,
}: {
  dateKey: string;
  occurrences: Task[];
  deviceEvents: DeviceEvent[];
  onPressTask: (task: Task) => void;
  onCreateAt: (time: string) => void;
  accent: string;
}) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const categories = useStore((s) => s.categories);
  const catColor = (id?: string) => categories.find((c) => c.id === id)?.color ?? accent;

  const { allDayItems, blocks } = useMemo(() => {
    const allDayItems: { id: string; title: string; color: string; task?: Task }[] = [];
    const raw: Omit<Block, 'lane' | 'lanes'>[] = [];

    for (const t of occurrences) {
      const start = t.allDay ? null : minutesOfDay(t.time ?? '');
      if (start == null) {
        allDayItems.push({ id: t.id, title: t.title, color: catColor(t.categoryId), task: t });
        continue;
      }
      const dur = t.estimateMinutes && t.estimateMinutes > 0 ? t.estimateMinutes : 30;
      raw.push({
        id: `t-${t.id}`,
        title: t.title,
        startMin: start,
        endMin: Math.min(24 * 60, start + dur),
        kind: 'task',
        task: t,
        color: catColor(t.categoryId),
        done: isOccurrenceDone(t, dateKey),
      });
    }

    for (const e of deviceEvents) {
      if (e.allDay) {
        allDayItems.push({ id: e.id, title: e.title, color: colors.textFaint });
        continue;
      }
      const start = minutesOfDay(e.start.slice(11, 16));
      const end = minutesOfDay(e.end.slice(11, 16));
      if (start == null) continue;
      raw.push({
        id: `e-${e.id}`,
        title: e.title,
        startMin: start,
        endMin: end != null && end > start ? end : start + 30,
        kind: 'event',
        color: colors.textFaint,
      });
    }

    return { allDayItems, blocks: packLanes(raw) };
  }, [occurrences, deviceEvents, dateKey]);

  const scrollRef = useRef<ScrollView>(null);
  const isToday = dateKey === todayKey();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const trackWidthInsets = GUTTER + spacing(1);

  return (
    <View style={styles.wrap}>
      {allDayItems.length > 0 && (
        <View style={styles.allDayBar}>
          <Text style={styles.allDayLabel}>All-day</Text>
          <View style={styles.allDayItems}>
            {allDayItems.map((it) => (
              <Pressable
                key={it.id}
                disabled={!it.task}
                onPress={() => it.task && onPressTask(it.task)}
                style={[styles.allDayChip, { borderColor: it.color, backgroundColor: it.color + '22' }]}
              >
                <Text style={styles.allDayChipText} numberOfLines={1}>
                  {it.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentOffset={{ x: 0, y: Math.max(0, (7 - DAY_START_HOUR) * HOUR_HEIGHT - 20) }}
      >
        <View style={{ height: HOURS.length * HOUR_HEIGHT }}>
          {HOURS.map((h) => (
            <Pressable
              key={h}
              style={[styles.hourRow, { top: (h - DAY_START_HOUR) * HOUR_HEIGHT }]}
              onPress={() => onCreateAt(`${String(h).padStart(2, '0')}:00`)}
            >
              <Text style={styles.hourLabel}>{hourLabel(h)}</Text>
              <View style={styles.hourLine} />
            </Pressable>
          ))}

          {isToday && nowMin >= DAY_START_HOUR * 60 && (
            <View
              pointerEvents="none"
              style={[styles.nowLine, { top: (nowMin - DAY_START_HOUR * 60) / 60 * HOUR_HEIGHT }]}
            >
              <View style={styles.nowDot} />
              <View style={styles.nowBar} />
            </View>
          )}

          {blocks.map((b) => {
            const top = (b.startMin - DAY_START_HOUR * 60) / 60 * HOUR_HEIGHT;
            const height = Math.max(22, ((b.endMin - b.startMin) / 60) * HOUR_HEIGHT - 2);
            const laneW = `${100 / b.lanes}%`;
            return (
              <Pressable
                key={b.id}
                disabled={b.kind !== 'task'}
                onPress={() => b.task && onPressTask(b.task)}
                style={[
                  styles.block,
                  {
                    top,
                    height,
                    left: trackWidthInsets,
                  },
                  b.kind === 'event' && styles.eventBlock,
                ]}
              >
                <View
                  style={[
                    styles.blockInner,
                    {
                      width: laneW as any,
                      marginLeft: `${(100 / b.lanes) * b.lane}%` as any,
                      borderLeftColor: b.color,
                      backgroundColor: b.kind === 'event' ? colors.surfaceAlt : b.color + '26',
                    },
                  ]}
                >
                  <Text
                    style={[styles.blockTitle, b.done && styles.blockDone]}
                    numberOfLines={height > 34 ? 2 : 1}
                  >
                    {b.kind === 'event' ? '🗓 ' : ''}
                    {b.title}
                  </Text>
                  {height > 34 && (
                    <Text style={styles.blockMeta} numberOfLines={1}>
                      {pretty12h(
                        `${String(Math.floor(b.startMin / 60)).padStart(2, '0')}:${String(
                          b.startMin % 60,
                        ).padStart(2, '0')}`,
                      )}
                      {b.endMin - b.startMin >= 15 ? ` · ${prettyDuration(b.endMin - b.startMin)}` : ''}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: { flex: 1 },
  allDayBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  allDayLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700', width: GUTTER, paddingTop: 4, fontFamily },
  allDayItems: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  allDayChip: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.5),
    marginRight: spacing(0.75),
    marginBottom: spacing(0.5),
    maxWidth: 180,
  },
  allDayChipText: { color: colors.text, fontSize: 12, fontWeight: '600', fontFamily },
  hourRow: { position: 'absolute', left: 0, right: 0, height: HOUR_HEIGHT, flexDirection: 'row', alignItems: 'flex-start' },
  hourLabel: { width: GUTTER, color: colors.textFaint, fontSize: 11, textAlign: 'right', paddingRight: spacing(1), marginTop: -6, fontFamily },
  hourLine: { flex: 1, height: 1, backgroundColor: colors.border, marginTop: 0 },
  nowLine: { position: 'absolute', left: GUTTER - 4, right: 0, flexDirection: 'row', alignItems: 'center' },
  nowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  nowBar: { flex: 1, height: 1.5, backgroundColor: colors.danger },
  block: { position: 'absolute', right: spacing(1) },
  blockInner: {
    flex: 1,
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.5),
    overflow: 'hidden',
  },
  eventBlock: {},
  blockTitle: { color: colors.text, fontSize: 12, fontWeight: '600', fontFamily },
  blockDone: { textDecorationLine: 'line-through', color: colors.textDim },
  blockMeta: { color: colors.textDim, fontSize: 10, marginTop: 1, fontFamily },
});
