import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useHistory, HistoryEvent } from '../store/useHistory';
import { useStore } from '../store/useStore';
import { spacing, radius, fontFamily, useThemedStyles, Palette } from '../theme';

const VISIBLE_MS = 5000;

function formatMessage(ev: HistoryEvent): string {
  switch (ev.kind) {
    case 'undo':
      return `Undone · ${ev.label}`;
    case 'redo':
      return `Redone · ${ev.label}`;
    case 'push':
    default:
      return ev.label;
  }
}

export function UndoToast() {
  const styles = useThemedStyles(makeStyles);
  const event = useHistory((s) => s.lastEvent);
  const popUndo = useHistory((s) => s.popUndo);
  const popRedo = useHistory((s) => s.popRedo);
  const canUndo = useHistory((s) => s.undoStack.length > 0);
  const canRedo = useHistory((s) => s.redoStack.length > 0);

  const [shown, setShown] = useState<HistoryEvent | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!event) return;
    setShown(event);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(translateY, { toValue: 0, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
    hideTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(translateY, { toValue: 12, duration: 140, useNativeDriver: Platform.OS !== 'web' }),
      ]).start(({ finished }) => {
        if (finished) setShown(null);
      });
    }, VISIBLE_MS);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [event?.seq]);

  if (!shown) return null;

  // For a "push" event the action button reverts (Undo). For an undo event we
  // offer Redo; for a redo event we offer Undo again — symmetrical and matches
  // user expectation that the button reverses whatever just happened.
  const isUndoEvent = shown.kind === 'undo';
  const actionLabel = isUndoEvent ? 'Redo' : 'Undo';
  const actionDisabled = isUndoEvent ? !canRedo : !canUndo;

  const handleAction = () => {
    const cur = useStore.getState().tasks;
    const entry = isUndoEvent ? popRedo(cur) : popUndo(cur);
    if (entry) useStore.setState({ tasks: entry.tasks });
  };

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
        <Text style={styles.label} numberOfLines={1}>
          {formatMessage(shown)}
        </Text>
        <Pressable
          onPress={handleAction}
          disabled={actionDisabled}
          hitSlop={6}
          style={({ pressed }) => [
            styles.action,
            pressed && !actionDisabled ? styles.actionPressed : null,
            actionDisabled ? styles.actionDisabled : null,
          ]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    host: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: spacing(10),
      alignItems: 'center',
      paddingHorizontal: spacing(2),
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.pill,
      paddingVertical: spacing(1),
      paddingLeft: spacing(2),
      paddingRight: spacing(0.75),
      maxWidth: 460,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6,
    },
    label: {
      color: colors.text,
      fontFamily,
      fontSize: 13,
      fontWeight: '600',
      marginRight: spacing(1.5),
      flexShrink: 1,
    },
    action: {
      paddingHorizontal: spacing(1.25),
      paddingVertical: spacing(0.5),
      borderRadius: radius.pill,
      backgroundColor: colors.primaryDim,
    },
    actionPressed: { opacity: 0.7 },
    actionDisabled: { opacity: 0.4 },
    actionText: {
      color: colors.primary,
      fontFamily,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
  });
