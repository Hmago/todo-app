import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { radius, spacing, fontFamily, useTheme, useThemedStyles, Palette } from '../theme';
import { Button } from './ui';
import { useStore } from '../store/useStore';
import { showSystemNotification } from '../lib/notifications';

const PRESETS = [25, 50, 15];

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function FocusTimerModal({
  visible,
  goalId,
  goalTitle,
  accent,
  onClose,
}: {
  visible: boolean;
  goalId?: string;
  goalTitle?: string;
  accent?: string;
  onClose: () => void;
}) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const acc = accent ?? colors.primary;
  const logStudySession = useStore((s) => s.logStudySession);

  const [minutes, setMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (visible) {
      setMinutes(25);
      setSecondsLeft(25 * 60);
      setRunning(false);
      setCompleted(false);
    } else {
      clear();
    }
  }, [visible]);

  useEffect(() => {
    if (!running) {
      clear();
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clear();
          setRunning(false);
          setCompleted(true);
          logStudySession({ goalId, minutes });
          showSystemNotification(
            'Focus session complete 🎉',
            `${minutes} min logged${goalTitle ? ` · ${goalTitle}` : ''}`,
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return clear;
  }, [running]);

  const pickPreset = (m: number) => {
    clear();
    setRunning(false);
    setCompleted(false);
    setMinutes(m);
    setSecondsLeft(m * 60);
  };

  const elapsedMin = Math.round((minutes * 60 - secondsLeft) / 60);

  const logAndClose = () => {
    clear();
    if (!completed && elapsedMin >= 1) {
      logStudySession({ goalId, minutes: elapsedMin });
    }
    onClose();
  };

  const progress = 1 - secondsLeft / (minutes * 60);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={logAndClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.heading}>Focus timer</Text>
          {goalTitle ? <Text style={styles.goal}>📚 {goalTitle}</Text> : null}

          <View style={styles.presets}>
            {PRESETS.map((m) => (
              <Pressable
                key={m}
                onPress={() => pickPreset(m)}
                style={[styles.preset, minutes === m && { borderColor: acc, backgroundColor: acc + '22' }]}
              >
                <Text style={[styles.presetText, minutes === m && { color: acc, fontWeight: '800' }]}>{m}m</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.timer, { color: completed ? colors.success : colors.text }]}>{fmt(secondsLeft)}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%`, backgroundColor: acc }]} />
          </View>

          {completed ? (
            <Text style={[styles.status, { color: colors.success }]}>Logged {minutes} min 🎉</Text>
          ) : (
            <Text style={styles.status}>
              {running ? 'Stay focused…' : elapsedMin >= 1 ? `${elapsedMin} min so far` : 'Ready when you are'}
            </Text>
          )}

          {!completed ? (
            <View style={styles.controls}>
              <Button
                title={running ? 'Pause' : elapsedMin > 0 ? 'Resume' : 'Start'}
                onPress={() => setRunning((r) => !r)}
                style={{ flex: 1 }}
              />
              <Button title="Reset" variant="ghost" onPress={() => pickPreset(minutes)} style={{ flex: 1 }} />
            </View>
          ) : null}

          <Pressable onPress={logAndClose} style={styles.doneBtn}>
            <Text style={styles.doneText}>
              {completed ? 'Done' : elapsedMin >= 1 ? 'Log & close' : 'Close'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(3),
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2.5),
    alignItems: 'center',
  },
  heading: { color: colors.text, fontSize: 18, fontWeight: '800', fontFamily },
  goal: { color: colors.textDim, fontSize: 13, marginTop: 4, fontFamily },
  presets: { flexDirection: 'row', gap: spacing(1), marginTop: spacing(2) },
  preset: {
    paddingVertical: spacing(0.75),
    paddingHorizontal: spacing(2),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  presetText: { color: colors.textDim, fontSize: 14, fontWeight: '600', fontFamily },
  timer: {
    fontSize: 64,
    fontWeight: '900',
    marginTop: spacing(2),
    fontVariant: ['tabular-nums'],
    fontFamily: Platform.select({ web: 'ui-monospace, "Segoe UI", monospace', default: undefined }),
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: spacing(1.5),
  },
  progressFill: { height: 6, borderRadius: radius.pill },
  status: { color: colors.textDim, fontSize: 13, marginTop: spacing(1.5), fontFamily },
  controls: { flexDirection: 'row', gap: spacing(1.5), marginTop: spacing(2), width: '100%' },
  doneBtn: { paddingVertical: spacing(1.5), marginTop: spacing(0.5) },
  doneText: { color: colors.textDim, fontSize: 14, fontWeight: '700', fontFamily },
});

