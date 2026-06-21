import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { AppModal } from './AppModal';
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
  // Wall-clock target the countdown is racing toward while running. We derive
  // the displayed time from this instead of decrementing a counter, because
  // iOS Safari throttles/pauses setInterval for backgrounded PWAs — a
  // counter-based timer would freeze or drift, but recomputing from Date.now()
  // stays correct and self-heals the instant the app is foregrounded again.
  const endAtRef = useRef<number | null>(null);
  // Guards the one-shot completion side effects (log + notification) so a
  // resume that lands past the end time can't fire them twice.
  const firedRef = useRef(false);

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
      endAtRef.current = null;
      firedRef.current = false;
    } else {
      clear();
    }
  }, [visible]);

  const finish = (logMinutes: number) => {
    clear();
    endAtRef.current = null;
    setRunning(false);
    setCompleted(true);
    setSecondsLeft(0);
    if (!firedRef.current) {
      firedRef.current = true;
      logStudySession({ goalId, minutes: logMinutes });
      showSystemNotification(
        'Focus session complete 🎉',
        `${logMinutes} min logged${goalTitle ? ` · ${goalTitle}` : ''}`,
      );
    }
  };

  useEffect(() => {
    if (!running) {
      clear();
      // Drop the anchor so the next Start/Resume re-derives the end time from
      // the preserved `secondsLeft` — otherwise time spent paused (or
      // backgrounded while paused) would wrongly count down on resume.
      endAtRef.current = null;
      return;
    }
    firedRef.current = false;
    // Anchor the countdown to a fixed end timestamp derived from the remaining
    // seconds at the moment we (re)start, then tick off the wall clock.
    if (endAtRef.current == null) endAtRef.current = Date.now() + secondsLeft * 1000;

    const sync = () => {
      const end = endAtRef.current;
      if (end == null) return;
      const remaining = Math.max(0, Math.round((end - Date.now()) / 1000));
      if (remaining <= 0) {
        finish(minutes);
        return;
      }
      setSecondsLeft(remaining);
    };

    // 250ms cadence keeps the display smooth and snaps it back to the correct
    // value within a frame of the app resuming, rather than waiting a full
    // (throttled) second.
    intervalRef.current = setInterval(sync, 250);

    // Recompute the moment the tab/app becomes visible again — on iOS the
    // interval itself won't have been firing while backgrounded.
    const g: any = globalThis;
    const doc = g.document;
    const onVisible = () => {
      if (!doc || doc.visibilityState === 'visible') sync();
    };
    if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', onVisible);
    sync();

    return () => {
      clear();
      if (doc && doc.removeEventListener) doc.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const pickPreset = (m: number) => {
    clear();
    setRunning(false);
    setCompleted(false);
    setMinutes(m);
    setSecondsLeft(m * 60);
    endAtRef.current = null;
    firedRef.current = false;
  };

  const elapsedMin = Math.round((minutes * 60 - secondsLeft) / 60);

  const logAndClose = () => {
    clear();
    endAtRef.current = null;
    if (!completed && elapsedMin >= 1) {
      logStudySession({ goalId, minutes: elapsedMin });
    }
    onClose();
  };

  const progress = 1 - secondsLeft / (minutes * 60);

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={logAndClose}>
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
    </AppModal>
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

