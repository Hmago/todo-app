import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Linking } from 'react-native';
import { colors, radius, spacing, fontFamily, listThemes } from '../theme';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { LearningGoal, ResourceKind } from '../types';
import { Button, Card, EmptyState, ProgressBar } from '../components/ui';
import { GoalEditorModal } from '../components/GoalEditorModal';
import { FocusTimerModal } from '../components/FocusTimerModal';
import { ListHeader } from '../components/ListHeader';
import { prettyDate, prettyDuration } from '../lib/dates';
import {
  daysUntil,
  daysUntilReview,
  isReviewDue,
  minutesForGoal,
  sessionCountForGoal,
  studyActiveDays,
  studyStreak,
  totalMinutesSince,
  RESOURCE_ICON,
} from '../lib/study';
import { toKey } from '../lib/dates';
import { addDays } from 'date-fns';

const ACCENT = listThemes.learning.accent;
const RES_KINDS: ResourceKind[] = ['course', 'book', 'video', 'article', 'link'];

function countdownLabel(days: number | null): { text: string; color: string } | null {
  if (days == null) return null;
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: colors.danger };
  if (days === 0) return { text: 'Due today', color: colors.warning };
  if (days === 1) return { text: '1 day left', color: colors.textDim };
  return { text: `${days} days left`, color: colors.textDim };
}

function GoalCard({ goal, onFocus }: { goal: LearningGoal; onFocus: (g: LearningGoal) => void }) {
  const category = useStore((s) => s.categories.find((c) => c.id === goal.categoryId));
  const studySessions = useStore((s) => s.studySessions);
  const toggleMilestone = useStore((s) => s.toggleMilestone);
  const addMilestone = useStore((s) => s.addMilestone);
  const deleteMilestone = useStore((s) => s.deleteMilestone);
  const addResource = useStore((s) => s.addResource);
  const toggleResource = useStore((s) => s.toggleResource);
  const deleteResource = useStore((s) => s.deleteResource);
  const reviewGoal = useStore((s) => s.reviewGoal);
  const openNew = useUI((s) => s.openNew);

  const [newMs, setNewMs] = useState('');
  const [resTitle, setResTitle] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [resKind, setResKind] = useState<ResourceKind>('link');
  const [editGoal, setEditGoal] = useState(false);

  const done = goal.milestones.filter((m) => m.done).length;
  const pct = goal.milestones.length ? done / goal.milestones.length : 0;

  const totalMin = minutesForGoal(studySessions, goal.id);
  const sessions = sessionCountForGoal(studySessions, goal.id);
  const countdown = countdownLabel(daysUntil(goal.targetDate));
  const reviewDue = isReviewDue(goal);
  const reviewIn = daysUntilReview(goal);
  const resources = goal.resources ?? [];

  const addMs = () => {
    if (newMs.trim()) {
      addMilestone(goal.id, newMs.trim());
      setNewMs('');
    }
  };
  const addRes = () => {
    if (resTitle.trim()) {
      addResource(goal.id, resKind, resTitle.trim(), resUrl.trim() || undefined);
      setResTitle('');
      setResUrl('');
    }
  };

  return (
    <Card style={{ marginBottom: spacing(2) }}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.goalTitle}>{goal.title}</Text>
          {goal.description ? <Text style={styles.goalDesc}>{goal.description}</Text> : null}
          <View style={styles.tagRow}>
            {category ? (
              <View style={styles.tag}>
                <View style={[styles.dot, { backgroundColor: category.color }]} />
                <Text style={styles.tagText}>{category.name}</Text>
              </View>
            ) : null}
            {goal.targetDate ? <Text style={styles.tagText}>🎯 {prettyDate(goal.targetDate)}</Text> : null}
            {countdown ? <Text style={[styles.tagText, { color: countdown.color, fontWeight: '700' }]}>{countdown.text}</Text> : null}
          </View>
        </View>
        <Pressable onPress={() => setEditGoal(true)} hitSlop={8}>
          <Text style={styles.editIcon}>✎</Text>
        </Pressable>
      </View>

      <View style={styles.statRow}>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{prettyDuration(totalMin) || '0m'}</Text>
          <Text style={styles.statLabel}>focused</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{sessions}</Text>
          <Text style={styles.statLabel}>sessions</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{done}/{goal.milestones.length}</Text>
          <Text style={styles.statLabel}>milestones</Text>
        </View>
      </View>

      <View style={styles.progressWrap}>
        <ProgressBar value={pct} color={ACCENT} />
        <Text style={styles.progressText}>{Math.round(pct * 100)}% complete</Text>
      </View>

      {goal.sr?.enabled && (
        <View style={[styles.srBox, reviewDue && { borderColor: colors.warning }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.srTitle}>🧠 Spaced repetition</Text>
            <Text style={styles.srSub}>
              {reviewDue
                ? 'Review due now'
                : reviewIn != null
                ? `Next review in ${reviewIn} day${reviewIn === 1 ? '' : 's'}`
                : 'Scheduled'}
            </Text>
          </View>
          <Button
            title={reviewDue ? 'Review ✓' : 'Reviewed'}
            small
            variant={reviewDue ? 'primary' : 'ghost'}
            onPress={() => reviewGoal(goal.id)}
          />
        </View>
      )}

      {goal.milestones.map((m) => (
        <Pressable key={m.id} style={styles.msRow} onPress={() => toggleMilestone(goal.id, m.id)}>
          <View style={[styles.check, m.done && styles.checkDone]}>
            {m.done && <Text style={styles.checkMark}>✓</Text>}
          </View>
          <Text style={[styles.msText, m.done && styles.msDone]}>{m.title}</Text>
          <Pressable onPress={() => deleteMilestone(goal.id, m.id)} hitSlop={8}>
            <Text style={styles.msDelete}>✕</Text>
          </Pressable>
        </Pressable>
      ))}

      <View style={styles.addMsRow}>
        <TextInput
          value={newMs}
          onChangeText={setNewMs}
          placeholder="Add milestone…"
          placeholderTextColor={colors.textDim}
          style={styles.msInput}
          onSubmitEditing={addMs}
          returnKeyType="done"
        />
        <Button title="Add" small onPress={addMs} />
      </View>

      <Text style={styles.sectionLabel}>Resources</Text>
      {resources.length === 0 ? (
        <Text style={styles.emptyHint}>Add courses, books, videos or links you're learning from.</Text>
      ) : (
        resources.map((r) => (
          <View key={r.id} style={styles.resRow}>
            <Pressable onPress={() => toggleResource(goal.id, r.id)} hitSlop={6} style={styles.resCheckHit}>
              <View style={[styles.resCheck, r.done && styles.checkDone]}>{r.done && <Text style={styles.checkMark}>✓</Text>}</View>
            </Pressable>
            <Text style={styles.resIcon}>{RESOURCE_ICON[r.kind]}</Text>
            <Pressable style={{ flex: 1 }} disabled={!r.url} onPress={() => r.url && Linking.openURL(r.url)}>
              <Text style={[styles.resText, r.done && styles.msDone, !!r.url && styles.resLink]} numberOfLines={1}>
                {r.title}
              </Text>
            </Pressable>
            <Pressable onPress={() => deleteResource(goal.id, r.id)} hitSlop={8}>
              <Text style={styles.msDelete}>✕</Text>
            </Pressable>
          </View>
        ))
      )}
      <View style={styles.resKindRow}>
        {RES_KINDS.map((k) => (
          <Pressable
            key={k}
            onPress={() => setResKind(k)}
            style={[styles.kindChip, resKind === k && { borderColor: ACCENT, backgroundColor: ACCENT + '22' }]}
          >
            <Text style={[styles.kindText, resKind === k && { color: ACCENT, fontWeight: '700' }]}>
              {RESOURCE_ICON[k]} {k}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.addMsRow}>
        <TextInput
          value={resTitle}
          onChangeText={setResTitle}
          placeholder="Resource title"
          placeholderTextColor={colors.textDim}
          style={styles.msInput}
        />
      </View>
      <View style={styles.addMsRow}>
        <TextInput
          value={resUrl}
          onChangeText={setResUrl}
          placeholder="https://… (optional)"
          placeholderTextColor={colors.textDim}
          style={styles.msInput}
          autoCapitalize="none"
          keyboardType="url"
          onSubmitEditing={addRes}
          returnKeyType="done"
        />
        <Button title="Add" small onPress={addRes} />
      </View>

      <View style={styles.cardActions}>
        <Button title="⏱ Focus" small onPress={() => onFocus(goal)} style={{ flex: 1 }} />
        <Button
          title="+ Study session"
          variant="ghost"
          small
          style={{ flex: 1 }}
          onPress={() => openNew({ type: 'study', goalId: goal.id })}
        />
      </View>

      <GoalEditorModal visible={editGoal} editing={goal} onClose={() => setEditGoal(false)} />
    </Card>
  );
}

export function LearningScreen({ onBack }: { onBack?: () => void }) {
  const goals = useStore((s) => s.goals);
  const tasks = useStore((s) => s.tasks);
  const studySessions = useStore((s) => s.studySessions);
  const [creating, setCreating] = useState(false);
  const [focusGoal, setFocusGoal] = useState<LearningGoal | null>(null);
  const [focusVisible, setFocusVisible] = useState(false);

  const { streak, weekMin } = useMemo(() => {
    const active = studyActiveDays(studySessions, tasks);
    const since = toKey(addDays(new Date(), -6));
    return { streak: studyStreak(active), weekMin: totalMinutesSince(studySessions, since) };
  }, [studySessions, tasks]);

  const openFocus = (g: LearningGoal) => {
    setFocusGoal(g);
    setFocusVisible(true);
  };

  return (
    <View style={styles.screen}>
      <ListHeader
        themeKey="learning"
        icon="📚"
        title="Learning goals"
        onBack={onBack}
        right={
          <Pressable onPress={() => setCreating(true)} hitSlop={8}>
            <Text style={styles.headerAdd}>+ New</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroRow}>
          <View style={styles.hero}>
            <Text style={styles.heroValue}>{streak}🔥</Text>
            <Text style={styles.heroLabel}>day study streak</Text>
          </View>
          <View style={styles.hero}>
            <Text style={styles.heroValue}>{prettyDuration(weekMin) || '0m'}</Text>
            <Text style={styles.heroLabel}>focused this week</Text>
          </View>
          <Pressable style={[styles.hero, styles.heroBtn]} onPress={() => { setFocusGoal(null); setFocusVisible(true); }}>
            <Text style={styles.heroBtnIcon}>⏱</Text>
            <Text style={styles.heroLabel}>Focus now</Text>
          </Pressable>
        </View>

        {goals.length === 0 ? (
          <EmptyState icon="📚" title="No goals yet" subtitle="Create a learning goal and break it into milestones." />
        ) : (
          goals.map((g) => <GoalCard key={g.id} goal={g} onFocus={openFocus} />)
        )}

        <GoalEditorModal visible={creating} onClose={() => setCreating(false)} />
        <View style={{ height: spacing(4) }} />
      </ScrollView>

      <FocusTimerModal
        visible={focusVisible}
        goalId={focusGoal?.id}
        goalTitle={focusGoal?.title}
        accent={ACCENT}
        onClose={() => setFocusVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(1.5) },
  headerAdd: { color: colors.primary, fontSize: 15, fontWeight: '700', fontFamily },
  heroRow: { flexDirection: 'row', gap: spacing(1.5), marginBottom: spacing(2) },
  hero: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(1.5),
    alignItems: 'center',
  },
  heroValue: { color: colors.text, fontSize: 22, fontWeight: '900', fontFamily },
  heroLabel: { color: colors.textDim, fontSize: 11, marginTop: 2, textAlign: 'center', fontFamily },
  heroBtn: { backgroundColor: ACCENT + '22', borderColor: ACCENT },
  heroBtnIcon: { fontSize: 22 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start' },
  goalTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  goalDesc: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  tagRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: spacing(0.5) },
  tag: { flexDirection: 'row', alignItems: 'center', marginRight: spacing(1.5) },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  tagText: { color: colors.textDim, fontSize: 12, marginRight: spacing(1) },
  editIcon: { color: colors.primary, fontSize: 18, fontWeight: '700', padding: 4 },
  statRow: { flexDirection: 'row', gap: spacing(1), marginTop: spacing(1.5) },
  statPill: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingVertical: spacing(1), alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 15, fontWeight: '800', fontFamily },
  statLabel: { color: colors.textDim, fontSize: 11, marginTop: 1, fontFamily },
  progressWrap: { marginVertical: spacing(1.5) },
  progressText: { color: colors.textDim, fontSize: 12, marginTop: 6 },
  srBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1.25),
    marginBottom: spacing(1),
  },
  srTitle: { color: colors.text, fontSize: 13, fontWeight: '700', fontFamily },
  srSub: { color: colors.textDim, fontSize: 12, marginTop: 1, fontFamily },
  msRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(0.75) },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(1.25),
  },
  checkDone: { backgroundColor: ACCENT, borderColor: ACCENT },
  checkMark: { color: colors.white, fontSize: 13, fontWeight: '900' },
  msText: { color: colors.text, fontSize: 14, flex: 1 },
  msDone: { textDecorationLine: 'line-through', color: colors.textDim },
  msDelete: { color: colors.textDim, fontSize: 14, paddingHorizontal: 6 },
  addMsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), marginTop: spacing(1) },
  msInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(1),
    color: colors.text,
    fontSize: 14,
  },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing(2),
    marginBottom: spacing(0.5),
    fontFamily,
  },
  emptyHint: { color: colors.textFaint, fontSize: 12, fontFamily },
  resRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(0.5) },
  resCheckHit: { marginRight: spacing(1) },
  resCheck: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resIcon: { fontSize: 14, marginRight: spacing(0.75) },
  resText: { color: colors.text, fontSize: 14 },
  resLink: { color: ACCENT, textDecorationLine: 'underline' },
  resKindRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing(1) },
  kindChip: {
    paddingVertical: spacing(0.5),
    paddingHorizontal: spacing(1),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing(0.75),
    marginBottom: spacing(0.75),
  },
  kindText: { color: colors.textDim, fontSize: 12, fontWeight: '600', fontFamily },
  cardActions: { flexDirection: 'row', gap: spacing(1), marginTop: spacing(1.5) },
});
