import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadow } from '../theme';
import { prettyReminder } from '../lib/dates';
import { RemindersApi } from '../lib/useReminders';

export default function ReminderBanner({ due, dismiss, complete, snooze }: RemindersApi) {
  if (due.length === 0) return null;
  const item = due[0];
  const { task, reminder } = item;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.card, shadow]}>
        <View style={styles.row}>
          <Text style={styles.bell}>🔔</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>
              {task.title}
            </Text>
            <Text style={styles.time}>{prettyReminder(reminder)}</Text>
          </View>
          {due.length > 1 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>+{due.length - 1}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable style={[styles.btn, styles.primaryBtn]} onPress={() => complete(item)}>
            <Text style={styles.primaryText}>Complete</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.ghostBtn]} onPress={() => snooze(item, 10)}>
            <Text style={styles.ghostText}>Snooze 10m</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.ghostBtn]} onPress={() => dismiss(item.key)}>
            <Text style={styles.ghostText}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: spacing(2),
    right: spacing(2),
    left: spacing(2),
    alignItems: 'flex-end',
    zIndex: 1000,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    gap: spacing(1.5),
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(1.5) },
  bell: { fontSize: 20, marginTop: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  time: { color: colors.primary, fontSize: 13, marginTop: 2 },
  badge: {
    backgroundColor: colors.primaryDim,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1),
    paddingVertical: 2,
  },
  badgeText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing(1), flexWrap: 'wrap' },
  btn: {
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
    borderRadius: radius.md,
  },
  primaryBtn: { backgroundColor: colors.primary },
  primaryText: { color: colors.onAccent, fontWeight: '600', fontSize: 13 },
  ghostBtn: { backgroundColor: colors.surfaceAlt },
  ghostText: { color: colors.textDim, fontWeight: '600', fontSize: 13 },
});
