import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Task, Priority, RecurrenceFreq, ItemType, RecurrenceRule, Subtask, TaskLink } from '../types';
import { radius, spacing, useTheme, useThemedStyles, Palette } from '../theme';
import { Button, Chip, Label } from './ui';
import { AppModal } from './AppModal';
import { DateTimeField } from './DateTimeField';
import { TimeSelect } from './TimeSelect';
import { todayKey, prettyReminder } from '../lib/dates';
import { WEEKDAY_ABBR } from '../lib/recurrence';
import { uid } from '../lib/id';
import { useStore } from '../store/useStore';
import { requestPermission, getPermission } from '../lib/notifications';
import {
  ESTIMATE_LEVELS,
  ESTIMATE_MINUTES,
  estimateLabel,
  estimateLevelOf,
} from '../lib/estimate';

export interface DraftSeed {
  date?: string;
  type?: ItemType;
  goalId?: string;
  important?: boolean;
  categoryId?: string;
}

const PRIORITIES: Priority[] = ['low', 'medium', 'high'];
const RECURRENCES: { v: RecurrenceFreq; label: string }[] = [
  { v: 'none', label: 'Once' },
  { v: 'daily', label: 'Daily' },
  { v: 'weekly', label: 'Weekly' },
  { v: 'monthly', label: 'Monthly' },
];
type RecurKind = RecurrenceRule['kind'];

export function TaskEditorModal({
  visible,
  editing,
  seed,
  onClose,
}: {
  visible: boolean;
  editing?: Task | null;
  seed?: DraftSeed;
  onClose: () => void;
}) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const categories = useStore((s) => s.categories);
  const goals = useStore((s) => s.goals);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [recurrence, setRecurrence] = useState<RecurrenceFreq>('none');
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [type, setType] = useState<ItemType>('task');
  const [goalId, setGoalId] = useState<string | undefined>(undefined);
  const [important, setImportant] = useState(false);
  const [reminders, setReminders] = useState<string[]>([]);
  const [customReminderDate, setCustomReminderDate] = useState('');
  const [customReminderTime, setCustomReminderTime] = useState('');
  const [recRule, setRecRule] = useState<RecurrenceRule | undefined>(undefined);
  const [everyN, setEveryN] = useState('2');
  const [recurrenceEnd, setRecurrenceEnd] = useState('');
  const [estimateMinutes, setEstimateMinutes] = useState<number | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subInput, setSubInput] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setTitle(editing.title);
      setNotes(editing.notes ?? '');
      setDate(editing.date);
      setTime(editing.time ?? '');
      setTargetDate(editing.targetDate ?? '');
      setPriority(editing.priority);
      setRecurrence(editing.recurrence);
      setCategoryId(editing.categoryId);
      setType(editing.type);
      setGoalId(editing.goalId);
      setImportant(!!editing.important);
      setReminders(editing.reminders ?? []);
      setCustomReminderDate(editing.date);
      setCustomReminderTime('09:00');
      setRecRule(editing.recurrenceRule);
      if (editing.recurrenceRule?.kind === 'everyNDays') setEveryN(String(editing.recurrenceRule.n));
      setRecurrenceEnd(editing.recurrenceEnd ?? '');
      setEstimateMinutes(editing.estimateMinutes);
      setTags(editing.tags ?? []);
      setTagInput('');
      setLinks(editing.links ?? []);
      setLinkUrl('');
      setLinkLabel('');
      setSubtasks(editing.subtasks ?? []);
      setSubInput('');
    } else {
      setTitle('');
      setNotes('');
      setDate(seed?.date ?? todayKey());
      setTime('');
      setTargetDate(seed?.date ?? todayKey());
      setPriority('medium');
      setRecurrence('none');
      setCategoryId(seed?.categoryId);
      setType(seed?.type ?? 'task');
      setGoalId(seed?.goalId);
      setImportant(!!seed?.important);
      setReminders([]);
      setCustomReminderDate(seed?.date ?? todayKey());
      setCustomReminderTime('09:00');
      setRecRule(undefined);
      setEveryN('2');
      setRecurrenceEnd('');
      setEstimateMinutes(undefined);
      setTags([]);
      setTagInput('');
      setLinks([]);
      setLinkUrl('');
      setLinkLabel('');
      setSubtasks([]);
      setSubInput('');
    }
  }, [visible, editing, seed]);

  const addReminder = (iso: string) => {
    if (!iso) return;
    setReminders((prev) => (prev.includes(iso) ? prev : [...prev, iso].sort()));
    if (getPermission() === 'default') requestPermission();
  };

  const removeReminder = (iso: string) =>
    setReminders((prev) => prev.filter((r) => r !== iso));

  const addCustomReminder = () => {
    const d = customReminderDate.trim();
    const t = customReminderTime.trim();
    if (!d || !t) return;
    const iso = `${d}T${t}`;
    if (Number.isNaN(new Date(iso).getTime())) return;
    addReminder(iso);
  };

  const pickSimpleRecurrence = (v: RecurrenceFreq) => {
    setRecRule(undefined);
    setRecurrence(v);
  };

  const pickCustomKind = (kind: RecurKind) => {
    setRecurrence('none');
    if (kind === 'everyNDays') setRecRule({ kind, n: Math.max(1, parseInt(everyN, 10) || 1) });
    else if (kind === 'weekdays') setRecRule({ kind, days: [1, 2, 3, 4, 5] });
    else setRecRule({ kind: 'lastWeekdayOfMonth', weekday: 5 });
  };

  const toggleWeekday = (d: number) =>
    setRecRule((prev) => {
      if (!prev || prev.kind !== 'weekdays') return prev;
      const days = prev.days.includes(d) ? prev.days.filter((x) => x !== d) : [...prev.days, d];
      return { kind: 'weekdays', days };
    });

  const setEveryNDays = (txt: string) => {
    setEveryN(txt);
    const n = parseInt(txt, 10);
    if (n > 0) setRecRule({ kind: 'everyNDays', n });
  };

  const addSubtask = () => {
    const t = subInput.trim();
    if (!t) return;
    setSubtasks((prev) => [...prev, { id: uid('st-'), title: t, done: false }]);
    setSubInput('');
  };
  const toggleSub = (id: string) =>
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
  const removeSub = (id: string) => setSubtasks((prev) => prev.filter((s) => s.id !== id));

  const addTag = () => {
    const parts = tagInput
      .split(',')
      .map((s) => s.trim().replace(/^#/, ''))
      .filter(Boolean);
    if (parts.length === 0) return;
    setTags((prev) => Array.from(new Set([...prev, ...parts])));
    setTagInput('');
  };
  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const addLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    setLinks((prev) => [...prev, { id: uid('ln-'), url, label: linkLabel.trim() || undefined }]);
    setLinkUrl('');
    setLinkLabel('');
  };
  const removeLink = (id: string) => setLinks((prev) => prev.filter((l) => l.id !== id));

  const save = () => {
    const t = title.trim();
    if (!t) return;
    let rule = recRule;
    if (rule && rule.kind === 'weekdays' && rule.days.length === 0) rule = undefined;
    const payload = {
      title: t,
      notes: notes.trim() || undefined,
      categoryId,
      tags: tags.length ? tags : undefined,
      date,
      startDate: undefined,
      targetDate: targetDate.trim() || undefined,
      allDay: undefined,
      time: time.trim() || undefined,
      estimateMinutes,
      priority,
      recurrence: rule ? 'none' : recurrence,
      recurrenceRule: rule,
      recurrenceEnd:
        (rule || recurrence !== 'none') && recurrenceEnd.trim() && recurrenceEnd.trim() >= date
          ? recurrenceEnd.trim()
          : undefined,
      important,
      type,
      reminders: reminders.length ? reminders : undefined,
      subtasks: subtasks.length ? subtasks : undefined,
      links: links.length ? links : undefined,
      goalId: type === 'study' ? goalId : undefined,
    };
    if (editing) updateTask(editing.id, payload);
    else addTask(payload);
    onClose();
  };

  const remove = () => {
    if (editing) deleteTask(editing.id);
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
            <Text style={styles.heading}>{editing ? 'Edit task' : 'New task'}</Text>

            <Label>Title</Label>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What do you need to do?"
              placeholderTextColor={colors.textDim}
              style={styles.input}
              autoFocus
            />

            <Label>Notes</Label>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional details"
              placeholderTextColor={colors.textDim}
              style={[styles.input, styles.multiline]}
              multiline
            />

            <Label>Subtasks</Label>
            {subtasks.map((st) => (
              <View key={st.id} style={styles.subRow}>
                <Pressable onPress={() => toggleSub(st.id)} hitSlop={8} style={styles.subCheckHit}>
                  <View style={[styles.subCheck, st.done && styles.subCheckDone]}>
                    {st.done ? <Text style={styles.subCheckMark}>✓</Text> : null}
                  </View>
                </Pressable>
                <Text style={[styles.subText, st.done && styles.subTextDone]} numberOfLines={1}>
                  {st.title}
                </Text>
                <Pressable onPress={() => removeSub(st.id)} hitSlop={8}>
                  <Text style={styles.removeX}>✕</Text>
                </Pressable>
              </View>
            ))}
            <View style={styles.customRow}>
              <TextInput
                value={subInput}
                onChangeText={setSubInput}
                placeholder="Add a subtask"
                placeholderTextColor={colors.textDim}
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                onSubmitEditing={addSubtask}
                returnKeyType="done"
              />
              <Button title="Add" small onPress={addSubtask} />
            </View>

            <Label>Type</Label>
            <View style={styles.rowWrap}>
              <Chip label="📋 Task" active={type === 'task'} onPress={() => setType('task')} />
              <Chip label="📚 Study session" active={type === 'study'} onPress={() => setType('study')} />
              <Chip
                label={important ? '★ Important' : '☆ Important'}
                color={colors.star}
                active={important}
                onPress={() => setImportant((v) => !v)}
              />
            </View>

            {type === 'study' && goals.length > 0 && (
              <>
                <Label>Linked goal</Label>
                <View style={styles.rowWrap}>
                  {goals.map((g) => (
                    <Chip
                      key={g.id}
                      label={g.title}
                      active={goalId === g.id}
                      onPress={() => setGoalId(goalId === g.id ? undefined : g.id)}
                    />
                  ))}
                </View>
              </>
            )}

            <Label>Date</Label>
            <DateTimeField mode="date" value={date} onChange={setDate} style={styles.input} />

            <View style={styles.dateTimeRow}>
              <View style={styles.dateCol}>
                <Label>Target date</Label>
                <DateTimeField
                  mode="date"
                  value={targetDate}
                  onChange={setTargetDate}
                  placeholder="yyyy-mm-dd (optional)"
                  style={styles.input}
                />
              </View>
              <View style={styles.timeCol}>
                <Label>Time (optional)</Label>
                <TimeSelect value={time} onChange={setTime} />
              </View>
            </View>
            {targetDate || time ? (
              <View style={styles.rowWrap}>
                {targetDate ? (
                  <Chip label="Clear date" color={colors.danger} onPress={() => setTargetDate('')} />
                ) : null}
                {time ? (
                  <Chip label="Clear time" color={colors.danger} onPress={() => setTime('')} />
                ) : null}
              </View>
            ) : null}

            <Label>Remind me</Label>
            {reminders.length > 0 ? (
              <View style={styles.rowWrap}>
                {reminders.map((r) => (
                  <Pressable key={r} style={styles.reminderPill} onPress={() => removeReminder(r)}>
                    <Text style={styles.reminderPillText}>🔔 {prettyReminder(r)}</Text>
                    <Text style={styles.reminderPillX}>✕</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {reminders.length > 0 ? (
              <View style={styles.rowWrap}>
                <Chip label="Clear all" color={colors.danger} onPress={() => setReminders([])} />
              </View>
            ) : null}
            <View style={styles.customRow}>
              <View style={styles.customReminderField}>
                <DateTimeField
                  mode="date"
                  value={customReminderDate}
                  onChange={setCustomReminderDate}
                  style={[styles.input, { marginBottom: 0 }]}
                />
              </View>
              <View style={styles.customReminderField}>
                <DateTimeField
                  mode="time"
                  value={customReminderTime}
                  onChange={setCustomReminderTime}
                  style={[styles.input, { marginBottom: 0 }]}
                />
              </View>
              <Button title="Add" small onPress={addCustomReminder} />
            </View>

            <Label>Priority</Label>
            <View style={styles.rowWrap}>
              {PRIORITIES.map((p) => (
                <Chip key={p} label={p} active={priority === p} onPress={() => setPriority(p)} />
              ))}
            </View>

            <Label>Repeat</Label>
            <View style={styles.rowWrap}>
              {RECURRENCES.map((r) => (
                <Chip
                  key={r.v}
                  label={r.label}
                  active={!recRule && recurrence === r.v}
                  onPress={() => pickSimpleRecurrence(r.v)}
                />
              ))}
              <Chip label="Custom…" active={!!recRule} onPress={() => pickCustomKind('weekdays')} />
            </View>
            {recRule ? (
              <View style={styles.customBox}>
                <View style={styles.rowWrap}>
                  <Chip
                    label="Every N days"
                    active={recRule.kind === 'everyNDays'}
                    onPress={() => pickCustomKind('everyNDays')}
                  />
                  <Chip
                    label="Weekdays"
                    active={recRule.kind === 'weekdays'}
                    onPress={() => pickCustomKind('weekdays')}
                  />
                  <Chip
                    label="Last weekday / month"
                    active={recRule.kind === 'lastWeekdayOfMonth'}
                    onPress={() => pickCustomKind('lastWeekdayOfMonth')}
                  />
                </View>
                {recRule.kind === 'everyNDays' ? (
                  <View style={styles.customRow}>
                    <Text style={styles.fieldLabel}>Every</Text>
                    <TextInput
                      value={everyN}
                      onChangeText={setEveryNDays}
                      keyboardType="number-pad"
                      style={[styles.input, styles.numInput, { marginBottom: 0 }]}
                    />
                    <Text style={styles.fieldLabel}>days</Text>
                  </View>
                ) : null}
                {recRule.kind === 'weekdays' ? (
                  <View style={styles.rowWrap}>
                    {WEEKDAY_ABBR.map((d, i) => (
                      <Chip
                        key={d}
                        label={d}
                        active={recRule!.kind === 'weekdays' && recRule!.days.includes(i)}
                        onPress={() => toggleWeekday(i)}
                      />
                    ))}
                  </View>
                ) : null}
                {recRule.kind === 'lastWeekdayOfMonth' ? (
                  <View style={styles.rowWrap}>
                    {WEEKDAY_ABBR.map((d, i) => (
                      <Chip
                        key={d}
                        label={d}
                        active={recRule!.kind === 'lastWeekdayOfMonth' && recRule!.weekday === i}
                        onPress={() => setRecRule({ kind: 'lastWeekdayOfMonth', weekday: i })}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {recRule || recurrence !== 'none' ? (
              <>
                <Label>Ends</Label>
                <DateTimeField
                  mode="date"
                  value={recurrenceEnd}
                  onChange={setRecurrenceEnd}
                  placeholder="yyyy-mm-dd (never)"
                  style={styles.input}
                />
                {recurrenceEnd ? (
                  <View style={styles.rowWrap}>
                    <Chip label="Clear" color={colors.danger} onPress={() => setRecurrenceEnd('')} />
                  </View>
                ) : null}
              </>
            ) : null}

            <Label>Estimate</Label>
            <View style={styles.rowWrap}>
              {ESTIMATE_LEVELS.map((lvl) => {
                const active = estimateLevelOf(estimateMinutes) === lvl;
                return (
                  <Chip
                    key={lvl}
                    label={estimateLabel(lvl)}
                    active={active}
                    onPress={() =>
                      setEstimateMinutes(active ? undefined : ESTIMATE_MINUTES[lvl])
                    }
                  />
                );
              })}
              {estimateMinutes ? (
                <Chip label="Clear" color={colors.danger} onPress={() => setEstimateMinutes(undefined)} />
              ) : null}
            </View>

            <Label>Tags</Label>
            {tags.length > 0 ? (
              <View style={styles.rowWrap}>
                {tags.map((t) => (
                  <Pressable key={t} style={styles.tagPill} onPress={() => removeTag(t)}>
                    <Text style={styles.tagText}>#{t}</Text>
                    <Text style={styles.removeX}>✕</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={styles.customRow}>
              <TextInput
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="Add tags (comma separated)"
                placeholderTextColor={colors.textDim}
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                autoCapitalize="none"
                onSubmitEditing={addTag}
                returnKeyType="done"
              />
              <Button title="Add" small onPress={addTag} />
            </View>

            <Label>Links</Label>
            {links.map((l) => (
              <View key={l.id} style={styles.subRow}>
                <Text style={styles.linkIcon}>🔗</Text>
                <Text style={styles.subText} numberOfLines={1}>
                  {l.label ? `${l.label} — ${l.url}` : l.url}
                </Text>
                <Pressable onPress={() => removeLink(l.id)} hitSlop={8}>
                  <Text style={styles.removeX}>✕</Text>
                </Pressable>
              </View>
            ))}
            <TextInput
              value={linkLabel}
              onChangeText={setLinkLabel}
              placeholder="Label (optional)"
              placeholderTextColor={colors.textDim}
              style={styles.input}
            />
            <View style={styles.customRow}>
              <TextInput
                value={linkUrl}
                onChangeText={setLinkUrl}
                placeholder="https://…"
                placeholderTextColor={colors.textDim}
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                autoCapitalize="none"
                keyboardType="url"
                onSubmitEditing={addLink}
                returnKeyType="done"
              />
              <Button title="Add" small onPress={addLink} />
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

            <View style={styles.actions}>
              <Button title="Save" onPress={save} style={{ flex: 1 }} />
              <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            </View>
            {editing && (
              <Pressable onPress={remove} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>Delete task</Text>
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
  reminderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.75),
    backgroundColor: colors.primaryDim,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.75),
    marginRight: spacing(1),
    marginBottom: spacing(1),
  },
  reminderPillText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  reminderPillX: { color: colors.primary, fontSize: 12, opacity: 0.8 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), marginBottom: spacing(1) },
  customReminderField: { flex: 1 },
  dateTimeRow: { flexDirection: 'row', gap: spacing(1.5) },
  dateCol: { flex: 2 },
  timeCol: { flex: 1 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing(1) },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    paddingVertical: spacing(0.5),
    marginBottom: spacing(0.5),
  },
  subCheckHit: { padding: 2 },
  subCheck: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subCheckDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  subCheckMark: { color: '#fff', fontSize: 12, fontWeight: '800' },
  subText: { flex: 1, color: colors.text, fontSize: 14 },
  subTextDone: { textDecorationLine: 'line-through', color: colors.textDim },
  removeX: { color: colors.textDim, fontSize: 13, paddingHorizontal: spacing(0.5) },
  linkIcon: { fontSize: 14 },
  customBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(1.25),
    marginBottom: spacing(1),
  },
  fieldLabel: { color: colors.textDim, fontSize: 14 },
  numInput: { width: 64, textAlign: 'center' },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.5),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.5),
    marginRight: spacing(1),
    marginBottom: spacing(1),
  },
  tagText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing(1.5), marginTop: spacing(1) },
  deleteBtn: { alignItems: 'center', paddingVertical: spacing(1.5), marginTop: spacing(0.5) },
  deleteText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
