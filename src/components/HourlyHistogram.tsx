import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { radius, spacing, fontFamily, useTheme, useThemedStyles, Palette } from '../theme';
import { HourHistogram } from '../lib/analytics';
import { pretty12h, prettyDuration } from '../lib/dates';

const TICK_HOURS = [0, 6, 12, 18, 23];

function hourLabel(h: number): string {
  return pretty12h(`${String(h).padStart(2, '0')}:00`).replace(':00 ', '').toLowerCase();
}

export function HourlyHistogram({
  data,
  accent,
  focusAccent,
}: {
  data: HourHistogram;
  accent?: string;
  focusAccent?: string;
}) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [hover, setHover] = useState<number | null>(null);
  const acc = accent ?? colors.primary;
  const focusAcc = focusAccent ?? colors.warning;

  const { maxCount, maxFocus } = useMemo(() => {
    let mc = 0;
    let mf = 0;
    for (const b of data.hours) {
      if (b.completed > mc) mc = b.completed;
      if (b.focusMin > mf) mf = b.focusMin;
    }
    return { maxCount: Math.max(1, mc), maxFocus: Math.max(1, mf) };
  }, [data]);

  const peak = data.peakHour;
  const tip = hover != null ? data.hours[hover] : null;

  return (
    <View>
      <View style={styles.chart}>
        {data.hours.map((b) => {
          const completedH = (b.completed / maxCount) * 80;
          const focusH = (b.focusMin / maxFocus) * 80;
          const isPeak = peak != null && b.hour === peak && b.completed > 0;
          const isHovered = hover === b.hour;
          return (
            <Pressable
              key={b.hour}
              style={styles.col}
              onHoverIn={() => setHover(b.hour)}
              onHoverOut={() => setHover((cur) => (cur === b.hour ? null : cur))}
              onPress={() => setHover((cur) => (cur === b.hour ? null : b.hour))}
            >
              <View style={styles.track}>
                {b.focusMin > 0 ? (
                  <View
                    style={[
                      styles.focusBar,
                      { height: Math.max(2, focusH), backgroundColor: focusAcc + '55' },
                    ]}
                  />
                ) : null}
                {b.completed > 0 ? (
                  <View
                    style={[
                      styles.completedBar,
                      {
                        height: Math.max(2, completedH),
                        backgroundColor: isPeak ? acc : acc + 'cc',
                        borderColor: isHovered ? colors.text : 'transparent',
                      },
                    ]}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.axis}>
        {TICK_HOURS.map((h) => (
          <Text
            key={h}
            style={[styles.tick, { left: `${(h / 23) * 100}%` }]}
            numberOfLines={1}
          >
            {hourLabel(h)}
          </Text>
        ))}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: acc }]} />
          <Text style={styles.legendText}>Completions</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: focusAcc + '55' }]} />
          <Text style={styles.legendText}>Focus minutes</Text>
        </View>
      </View>

      <View style={styles.summary}>
        {tip ? (
          <Text style={styles.summaryText}>
            {hourLabel(tip.hour)} – {tip.completed} done
            {tip.focusMin > 0 ? ` · ${prettyDuration(tip.focusMin)} focus` : ''}
          </Text>
        ) : peak != null ? (
          <Text style={styles.summaryText}>
            <Text style={[styles.summaryStrong, { color: acc }]}>Peak hour: {hourLabel(peak)}</Text>
            {`  ·  ${data.tracked} timed completion${data.tracked === 1 ? '' : 's'}`}
            {data.focusMin > 0 ? `  ·  ${prettyDuration(data.focusMin)} focus` : ''}
          </Text>
        ) : (
          <Text style={styles.summaryText}>
            {data.tracked + data.untracked === 0
              ? 'Complete tasks to see when you get the most done.'
              : 'No timed completions yet in this range.'}
          </Text>
        )}
        {data.untracked > 0 ? (
          <Text style={styles.footnote}>
            {data.untracked} completion{data.untracked === 1 ? '' : 's'} without a recorded time
            (older data).
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    chart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 96,
      justifyContent: 'space-between',
    },
    col: { flex: 1, alignItems: 'center', height: 96, justifyContent: 'flex-end' },
    track: {
      width: 8,
      height: 88,
      position: 'relative',
      justifyContent: 'flex-end',
    },
    focusBar: {
      position: 'absolute',
      left: -2,
      right: -2,
      bottom: 0,
      borderRadius: 3,
    },
    completedBar: {
      width: 8,
      borderRadius: 3,
      borderWidth: 1.5,
    },
    axis: {
      position: 'relative',
      height: 16,
      marginTop: spacing(0.5),
      marginHorizontal: 4,
    },
    tick: {
      position: 'absolute',
      transform: [{ translateX: -10 }],
      fontSize: 10,
      color: colors.textDim,
      fontFamily,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing(1.5),
      marginTop: spacing(0.5),
    },
    legendItem: { flexDirection: 'row', alignItems: 'center' },
    legendSwatch: { width: 10, height: 10, borderRadius: 2, marginRight: 4 },
    legendText: { color: colors.textDim, fontSize: 11, fontFamily },
    summary: { marginTop: spacing(1) },
    summaryText: { color: colors.textDim, fontSize: 12, fontFamily },
    summaryStrong: { fontWeight: '800', fontFamily },
    footnote: {
      color: colors.textFaint,
      fontSize: 11,
      marginTop: 2,
      fontStyle: 'italic',
      fontFamily,
    },
  });
