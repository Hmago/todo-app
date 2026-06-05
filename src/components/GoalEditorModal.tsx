import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LearningGoal, Milestone } from '../types';
import { radius, spacing, useTheme, useThemedStyles, Palette } from '../theme';
import { Button, Chip, Label } from './ui';
import { AppModal } from './AppModal';
import { DateTimeField } from './DateTimeField';
import { todayKey, shiftDateKey } from '../lib/dates';
import { nextSrDate } from '../lib/study';
import { useStore } from '../store/useStore';
import { uid } from '../lib/id';

export function GoalEditorModal({
  visible,
  editing,
  onClose,
}: {
  visible: boolean;
  editing?: LearningGoal | null;
  onClose: () => void;
}) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const categories = useStore((s) => s.categories);
  const addGoal = useStore((s) => s.addGoal);
  const updateGoal = useStore((s) => s.updateGoal);
  const deleteGoal = useStore((s) => s.deleteGoal);
  const setGoalSR = useStore((s) => s.setGoalSR);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [srEnabled, setSrEnabled] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [newMilestone, setNewMilestone] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? '');
      setTargetDate(editing.targetDate ?? '');
      setCategoryId(editing.categoryId);
      setSrEnabled(!!editing.sr?.enabled);
      setMilestones(editing.milestones ?? []);
    } else {
      setTitle('');
      setDescription('');
      setTargetDate('');
      setCategoryId(undefined);
      setSrEnabled(false);
      setMilestones([]);
    }
    setNewMilestone('');
  }, [visible, editing]);

  const addSubGoal = () => {
    const t = newMilestone.trim();
    if (!t) return;
    setMilestones((cur) => [...cur, { id: uid('m-'), title: t, done: false }]);
    setNewMilestone('');
  };
  const toggleSubGoal = (id: string) =>
    setMilestones((cur) => cur.map((m) => (m.id === id ? { ...m, done: !m.done } : m)));
  const removeSubGoal = (id: string) =>
    setMilestones((cur) => cur.filter((m) => m.id !== id));

  const save = () => {
    const t = title.trim();
    if (!t) return;
    const payload = {
      title: t,
      description: description.trim() || undefined,
      targetDate: targetDate.trim() || undefined,
      categoryId,
      milestones,
    };
    if (editing) {
      updateGoal(editing.id, payload);
      if (!!editing.sr?.enabled !== srEnabled) setGoalSR(editing.id, srEnabled);
    } else {
      addGoal({
        ...payload,
        sr: srEnabled
          ? { enabled: true, stage: 0, nextReview: nextSrDate(0, todayKey()) }
          : undefined,
      });
    }
    onClose();
  };

  return (
    <AppModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.heading}>{editing ? 'Edit goal' : 'New learning goal'}</Text>

            <Label>Goal</Label>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Learn Spanish basics"
              placeholderTextColor={colors.textDim}
              style={styles.input}
              autoFocus
            />

            <Label>Description</Label>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Why and what you want to achieve"
              placeholderTextColor={colors.textDim}
              style={[styles.input, styles.multiline]}
              multiline
            />

            <Label>Target date</Label>
            <DateTimeField
              mode="date"
              value={targetDate}
              onChange={setTargetDate}
              placeholder="yyyy-mm-dd (optional)"
              min={todayKey()}
              style={styles.input}
            />
            <View style={styles.rowWrap}>
              <Chip label="Today" onPress={() => setTargetDate(todayKey())} />
              <Chip label="+1 week" onPress={() => setTargetDate(shiftDateKey(todayKey(), 7))} />
              <Chip label="+1 month" onPress={() => setTargetDate(shiftDateKey(todayKey(), 30))} />
              <Chip label="+3 months" onPress={() => setTargetDate(shiftDateKey(todayKey(), 90))} />
              {targetDate ? <Chip label="Clear" onPress={() => setTargetDate('')} /> : null}
            </View>

            <Label>Category</Label>
            <View style={styles.rowWrap}>
              {categories.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  color={c.color}
                  active={categoryId === c.id}
                  onPress={() => setCategoryId(categoryId === c.id ? undefined : c.id)}
                />
              ))}
            </View>

            <Label>{`Milestones${milestones.length ? ` (${milestones.filter((m) => m.done).length}/${milestones.length})` : ''}`}</Label>
            <Text style={styles.subHint}>
              Break this goal into smaller checkable steps. You can tick them off as you progress.
            </Text>
            {milestones.map((m) => (
              <Pressable key={m.id} style={styles.subRow} onPress={() => toggleSubGoal(m.id)}>
                <View style={[styles.subCheck, m.done && styles.subCheckDone]}>
                  {m.done && <Text style={styles.subCheckMark}>✓</Text>}
                </View>
                <Text style={[styles.subTitle, m.done && styles.subTitleDone]} numberOfLines={2}>
                  {m.title}
                </Text>
                <Pressable onPress={() => removeSubGoal(m.id)} hitSlop={8}>
                  <Text style={styles.subDelete}>✕</Text>
                </Pressable>
              </Pressable>
            ))}
            <View style={styles.subAddRow}>
              <TextInput
                value={newMilestone}
                onChangeText={setNewMilestone}
                placeholder="Add a milestone…"
                placeholderTextColor={colors.textDim}
                style={[styles.input, styles.subAddInput]}
                onSubmitEditing={addSubGoal}
                returnKeyType="done"
                blurOnSubmit={false}
              />
              <Button title="Add" small onPress={addSubGoal} />
            </View>

            <View style={styles.srRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.srLabel}>🧠 Spaced repetition</Text>
                <Text style={styles.srHint}>Schedule spaced reviews (1, 3, 7, 16… days)</Text>
              </View>
              <Switch
                value={srEnabled}
                onValueChange={setSrEnabled}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.white}
              />
            </View>

            <View style={styles.actions}>
              <Button title="Save" onPress={save} style={{ flex: 1 }} />
              <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            </View>
            {editing && (
              <Pressable onPress={() => { deleteGoal(editing.id); onClose(); }} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>Delete goal</Text>
              </Pressable>
            )}
            <View style={{ height: spacing(3) }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </AppModal>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing(2.5),
    paddingTop: spacing(1.5),
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing(1.5),
  },
  heading: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing(1.5) },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1.25),
    color: colors.text,
    fontSize: 15,
    marginBottom: spacing(1),
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing(1) },
  srRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1.25),
    marginTop: spacing(1),
    marginBottom: spacing(0.5),
  },
  srLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  srHint: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  subHint: { color: colors.textDim, fontSize: 12, marginTop: -spacing(0.25), marginBottom: spacing(0.75) },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(1),
    marginBottom: spacing(0.75),
  },
  subCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subCheckDone: { borderColor: colors.success, backgroundColor: colors.success },
  subCheckMark: { color: colors.white, fontSize: 12, fontWeight: '800', lineHeight: 14 },
  subTitle: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  subTitleDone: { color: colors.textDim, textDecorationLine: 'line-through' },
  subDelete: { color: colors.textFaint, fontSize: 14, fontWeight: '700', paddingHorizontal: spacing(0.5) },
  subAddRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), marginBottom: spacing(1) },
  subAddInput: { flex: 1, marginBottom: 0 },
  actions: { flexDirection: 'row', gap: spacing(1.5), marginTop: spacing(1) },
  deleteBtn: { alignItems: 'center', paddingVertical: spacing(1.5) },
  deleteText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
