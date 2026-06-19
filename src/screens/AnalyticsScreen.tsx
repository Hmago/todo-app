import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { radius, spacing, fontFamily, listThemes, CATEGORY_COLORS, useTheme, useThemedStyles, Palette } from '../theme';
import { useStore } from '../store/useStore';
import { Card, ProgressBar, SectionTitle, Button } from '../components/ui';
import { ListHeader } from '../components/ListHeader';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { HourlyHistogram } from '../components/HourlyHistogram';
import { GoalProgressList } from '../components/GoalProgressList';
import { HabitAdherenceList } from '../components/HabitAdherence';
import { DateTimeField } from '../components/DateTimeField';
import { todayKey, toKey, fromKey, prettyDate, prettyDuration } from '../lib/dates';
import { addDays, format, startOfMonth, startOfYear, isValid, parseISO } from 'date-fns';
import { occursOn, isOccurrenceDone, isOccurrenceSkipped, expandRange } from '../lib/recurrence';
import { studyActiveDays, studyStreak, totalMinutesSince, minutesForGoal } from '../lib/study';
import {
  dailySeries,
  weeklyFromDaily,
  completionStreak,
  bestStreak,
  seriesTotals,
  previousPeriod,
  computeDelta,
  formatDelta,
  tagBreakdown,
  hourlyHistogram,
  recurringHabitStats,
  Delta,
} from '../lib/analytics';
import {
  tasksToCsv,
  sessionsToCsv,
  csvToTasks,
  parseCsv,
  downloadText,
  printHtml,
  pickCsvFile,
  isWeb,
} from '../lib/dataio';

const learnAccent = listThemes.learning.accent;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

type RangeKey = '7d' | '30d' | '90d' | 'mtd' | 'ytd' | '1y' | 'custom';
const RANGES: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'mtd', label: 'MTD' },
  { key: 'ytd', label: 'YTD' },
  { key: '1y', label: '1y' },
  { key: 'custom', label: 'Custom' },
];

function rangeFor(key: RangeKey, custom: { from: string; to: string }): { from: string; to: string } {
  const today = todayKey();
  switch (key) {
    case '7d':
      return { from: toKey(addDays(new Date(), -6)), to: today };
    case '30d':
      return { from: toKey(addDays(new Date(), -29)), to: today };
    case '90d':
      return { from: toKey(addDays(new Date(), -89)), to: today };
    case 'mtd':
      return { from: toKey(startOfMonth(new Date())), to: today };
    case 'ytd':
      return { from: toKey(startOfYear(new Date())), to: today };
    case '1y':
      return { from: toKey(addDays(new Date(), -364)), to: today };
    case 'custom':
      return custom;
  }
}

function validIsoKey(s: string): boolean {
  return ISO_RE.test(s) && isValid(parseISO(s));
}

export function AnalyticsScreen({ onBack }: { onBack?: () => void }) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tasks = useStore((s) => s.tasks);
  const categories = useStore((s) => s.categories);
  const goals = useStore((s) => s.goals);
  const studySessions = useStore((s) => s.studySessions);
  const addTask = useStore((s) => s.addTask);
  const addCategory = useStore((s) => s.addCategory);

  const [range, setRange] = useState<RangeKey>('30d');
  const [compare, setCompare] = useState(false);
  const todayKeyStr = todayKey();
  const [customFrom, setCustomFrom] = useState<string>(toKey(addDays(new Date(), -29)));
  const [customTo, setCustomTo] = useState<string>(todayKeyStr);
  const [notice, setNotice] = useState<string | null>(null);

  const customValid = validIsoKey(customFrom) && validIsoKey(customTo) && customFrom <= customTo;
  const { from, to } = useMemo(() => {
    if (range === 'custom' && !customValid) {
      // Fall back to last 30 days if user hasn't entered a valid custom range yet.
      return { from: toKey(addDays(new Date(), -29)), to: todayKeyStr };
    }
    return rangeFor(range, { from: customFrom, to: customTo });
  }, [range, customFrom, customTo, customValid, todayKeyStr]);

  const stats = useMemo(() => {
    const today = todayKey();
    const occRange = expandRange(tasks, from, to);

    const week: { label: string; total: number; done: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(new Date(), -i);
      const key = toKey(d);
      let total = 0;
      let done = 0;
      for (const t of tasks) {
        if (occursOn(t, key)) {
          total++;
          if (isOccurrenceDone(t, key)) done++;
        }
      }
      week.push({ label: format(d, 'EEEEE'), total, done });
    }

    const byCat = categories.map((c) => {
      const items = occRange.filter((o) => o.task.categoryId === c.id);
      const cdone = items.filter((o) => isOccurrenceDone(o.task, o.dateKey)).length;
      const cskip = items.filter((o) => isOccurrenceSkipped(o.task, o.dateKey)).length;
      return { category: c, total: items.length, done: cdone, skipped: cskip };
    });

    const doneToday = tasks.filter((t) => occursOn(t, today) && isOccurrenceDone(t, today)).length;
    const totalToday = tasks.filter((t) => occursOn(t, today)).length;

    const msTotal = goals.reduce((a, g) => a + g.milestones.length, 0);
    const msDone = goals.reduce((a, g) => a + g.milestones.filter((m) => m.done).length, 0);

    const studyStreakVal = studyStreak(studyActiveDays(studySessions, tasks));
    const focusWeek = totalMinutesSince(studySessions, toKey(addDays(new Date(), -6)));
    const focusTotal = studySessions.reduce((a, s) => a + s.minutes, 0);
    const byGoal = goals
      .map((g) => ({ goal: g, minutes: minutesForGoal(studySessions, g.id) }))
      .filter((x) => x.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);
    const maxGoalMin = Math.max(1, ...byGoal.map((b) => b.minutes));

    return {
      week,
      byCat,
      doneToday,
      totalToday,
      msTotal,
      msDone,
      activeTasks: tasks.length,
      studyStreakVal,
      focusWeek,
      focusTotal,
      byGoal,
      maxGoalMin,
    };
  }, [tasks, categories, goals, studySessions, from, to]);

  const series = useMemo(() => {
    const days = dailySeries(tasks, studySessions, from, to);
    const weeks = weeklyFromDaily(days);
    return {
      days,
      weeks: weeks.slice(-16),
      totals: seriesTotals(days),
      streak: completionStreak(days),
      best: bestStreak(days),
    };
  }, [tasks, studySessions, from, to]);

  const prev = useMemo(() => {
    if (!compare) return null;
    const p = previousPeriod(from, to);
    const days = dailySeries(tasks, studySessions, p.from, p.to);
    return { range: p, totals: seriesTotals(days) };
  }, [tasks, studySessions, from, to, compare]);

  const deltas = useMemo(() => {
    if (!prev) return null;
    return {
      completed: computeDelta(series.totals.completed, prev.totals.completed, 'count'),
      rate: computeDelta(series.totals.rate, prev.totals.rate, 'rate'),
      focus: computeDelta(series.totals.focusMin, prev.totals.focusMin, 'duration'),
      active: computeDelta(series.totals.activeDays, prev.totals.activeDays, 'count'),
    };
  }, [series, prev]);

  const tagStats = useMemo(() => tagBreakdown(tasks, from, to), [tasks, from, to]);

  const habits = useMemo(() => recurringHabitStats(tasks, from, to), [tasks, from, to]);

  // Lifetime, all-time totals across every task in the store. Used for the
  // "Lifetime totals" card at the top of the screen, which gives a stable
  // sense of overall volume independent of the date-range filter.
  const lifetime = useMemo(() => {
    let totalCompleted = 0;
    let totalSkipped = 0;
    type Bucket = { added: number; done: number; skipped: number };
    const perCat = new Map<string, Bucket>();
    let uncategorized: Bucket = { added: 0, done: 0, skipped: 0 };
    const ensure = (id: string): Bucket => {
      let v = perCat.get(id);
      if (!v) { v = { added: 0, done: 0, skipped: 0 }; perCat.set(id, v); }
      return v;
    };
    for (const t of tasks) {
      const done = t.completedDates.length;
      const skip = t.skippedDates?.length ?? 0;
      totalCompleted += done;
      totalSkipped += skip;
      const target = t.categoryId ? ensure(t.categoryId) : uncategorized;
      target.added += 1;
      target.done += done;
      target.skipped += skip;
    }
    const byCat = categories.map((c) => ({
      category: c,
      ...(perCat.get(c.id) ?? { added: 0, done: 0, skipped: 0 }),
    }));
    return {
      totalTasks: tasks.length,
      totalCompleted,
      totalSkipped,
      byCat,
      uncategorized,
    };
  }, [tasks, categories]);

  const hourStats = useMemo(
    () => hourlyHistogram(tasks, studySessions, from, to),
    [tasks, studySessions, from, to],
  );
  const rangeDays = useMemo(
    () =>
      Math.max(1, Math.round((fromKey(to).getTime() - fromKey(from).getTime()) / 86_400_000) + 1),
    [from, to],
  );

  const maxWeek = Math.max(1, ...stats.week.map((w) => w.total));
  const maxVel = Math.max(1, ...series.weeks.map((w) => w.completed));

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const onExportTasks = () => {
    downloadText(`learnplan-tasks-${todayKey()}.csv`, tasksToCsv(tasks, categories));
    flash(isWeb ? 'Tasks CSV downloaded.' : 'Tasks CSV shared.');
  };
  const onExportSessions = () => {
    downloadText(`learnplan-focus-${todayKey()}.csv`, sessionsToCsv(studySessions, goals));
    flash(isWeb ? 'Focus sessions CSV downloaded.' : 'Focus CSV shared.');
  };
  const onExportPdf = () => {
    const ok = printHtml(buildReportHtml(stats, series, rangeDays));
    flash(ok ? 'Opened printable report — choose “Save as PDF”.' : 'PDF export is available on web.');
  };
  const onImport = async () => {
    if (!isWeb) {
      flash('CSV import is available in the web app.');
      return;
    }
    const text = await pickCsvFile();
    if (!text) return;
    const { tasks: parsed, errors } = csvToTasks(parseCsv(text));
    if (parsed.length === 0) {
      flash(`No valid rows found${errors ? ` (${errors} skipped)` : ''}.`);
      return;
    }
    const nameToId = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
    let colorI = categories.length;
    for (const p of parsed) {
      let categoryId: string | undefined;
      if (p.categoryName) {
        const key = p.categoryName.toLowerCase();
        categoryId = nameToId.get(key);
        if (!categoryId) {
          categoryId = addCategory(p.categoryName, CATEGORY_COLORS[colorI++ % CATEGORY_COLORS.length]);
          nameToId.set(key, categoryId);
        }
      }
      addTask({
        title: p.title,
        notes: p.notes,
        categoryId,
        tags: p.tags,
        date: p.date,
        time: p.time,
        priority: p.priority,
        recurrence: p.recurrence,
        important: p.important,
        estimateMinutes: p.estimateMinutes,
        type: p.type,
      });
    }
    flash(`Imported ${parsed.length} task${parsed.length === 1 ? '' : 's'}${errors ? `, ${errors} skipped` : ''}.`);
  };

  return (
    <View style={styles.screen}>
      <ListHeader themeKey="stats" icon="📊" title="Analytics" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
        {notice ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        <SectionTitle>Lifetime totals</SectionTitle>
        <View style={styles.kpiRow}>
          <Kpi label="Tasks added" value={`${lifetime.totalTasks}`} color={colors.primary} />
          <Kpi label="Completed" value={`${lifetime.totalCompleted}`} color={colors.success} />
          <Kpi label="Skipped" value={`${lifetime.totalSkipped}`} color={colors.warning} />
        </View>
        <Card style={{ marginBottom: spacing(2) }}>
          {lifetime.totalTasks === 0 ? (
            <Text style={styles.dim}>No tasks yet — add a task to start tracking.</Text>
          ) : (
            <>
              {lifetime.byCat
                .filter((b) => b.added > 0)
                .sort((a, b) => b.added - a.added)
                .map((b) => {
                  const denom = Math.max(1, b.done + b.skipped);
                  return (
                    <View key={b.category.id} style={styles.catRow}>
                      <View style={styles.catHeader}>
                        <View style={[styles.dot, { backgroundColor: b.category.color }]} />
                        <Text style={styles.catName} numberOfLines={1}>{b.category.name}</Text>
                        <Text style={styles.catCount}>
                          {b.added} added · {b.done} done · {b.skipped} skipped
                        </Text>
                      </View>
                      <ProgressBar value={b.done / denom} color={b.category.color} />
                    </View>
                  );
                })}
              {lifetime.uncategorized.added > 0 && (
                <View style={styles.catRow}>
                  <View style={styles.catHeader}>
                    <View style={[styles.dot, { backgroundColor: colors.textFaint }]} />
                    <Text style={styles.catName} numberOfLines={1}>Uncategorized</Text>
                    <Text style={styles.catCount}>
                      {lifetime.uncategorized.added} added · {lifetime.uncategorized.done} done · {lifetime.uncategorized.skipped} skipped
                    </Text>
                  </View>
                  <ProgressBar
                    value={lifetime.uncategorized.done / Math.max(1, lifetime.uncategorized.done + lifetime.uncategorized.skipped)}
                    color={colors.textFaint}
                  />
                </View>
              )}
            </>
          )}
        </Card>

        <SectionTitle>Overview</SectionTitle>
        <View style={styles.rangeRow}>
          {RANGES.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => setRange(r.key)}
              style={[styles.rangeChip, range === r.key && styles.rangeChipActive]}
            >
              <Text style={[styles.rangeText, range === r.key && styles.rangeTextActive]}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
        {range === 'custom' ? (
          <View style={styles.customRow}>
            <View style={styles.customInputWrap}>
              <DateTimeField
                mode="date"
                value={customFrom}
                onChange={setCustomFrom}
                placeholder="YYYY-MM-DD"
                style={styles.customInput}
              />
            </View>
            <Text style={styles.customSep}>→</Text>
            <View style={styles.customInputWrap}>
              <DateTimeField
                mode="date"
                value={customTo}
                onChange={setCustomTo}
                placeholder="YYYY-MM-DD"
                min={customFrom || undefined}
                style={styles.customInput}
              />
            </View>
          </View>
        ) : null}
        {range === 'custom' && !customValid ? (
          <Text style={styles.dateError}>Enter valid dates as YYYY-MM-DD (from ≤ to). Showing last 30d.</Text>
        ) : null}
        <View style={styles.compareRow}>
          <Pressable
            onPress={() => setCompare((v) => !v)}
            style={[styles.compareToggle, compare && styles.compareToggleOn]}
          >
            <Text style={[styles.compareToggleText, compare && styles.compareToggleTextOn]}>
              {compare ? '✓ Compare prior period' : 'Compare prior period'}
            </Text>
          </Pressable>
          <Text style={styles.rangeSummary} numberOfLines={1}>
            {prettyDate(from)} – {prettyDate(to)} · {rangeDays}d
          </Text>
        </View>
        {compare && prev ? (
          <Text style={styles.compareSub}>
            vs {prettyDate(prev.range.from)} – {prettyDate(prev.range.to)}
          </Text>
        ) : null}

        <View style={styles.kpiRow}>
          <Kpi label="Done today" value={`${stats.doneToday}/${stats.totalToday}`} color={colors.success} />
          <Kpi label="Streak" value={`${series.streak}🔥`} color={colors.warning} />
        </View>
        <View style={styles.kpiRow}>
          <Kpi
            label={`Rate (${rangeDays}d)`}
            value={`${Math.round(series.totals.rate * 100)}%`}
            color={colors.primary}
            delta={deltas?.rate ?? null}
          />
          <Kpi label="Best streak" value={`${series.best}d`} color={colors.text} />
        </View>
        <View style={styles.kpiRow}>
          <Kpi
            label={`Completed (${rangeDays}d)`}
            value={`${series.totals.completed}`}
            color={colors.success}
            delta={deltas?.completed ?? null}
          />
          <Kpi
            label={`Focus (${rangeDays}d)`}
            value={prettyDuration(series.totals.focusMin) || '0m'}
            color={learnAccent}
            delta={deltas?.focus ?? null}
          />
        </View>

        <SectionTitle>Activity heatmap</SectionTitle>
        <Card style={{ marginBottom: spacing(2) }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <ActivityHeatmap days={series.days} accent={colors.success} />
          </ScrollView>
          <Text style={styles.heatSummary}>
            {series.totals.activeDays} active days · {series.totals.completed} completed ·{' '}
            {prettyDuration(series.totals.focusMin) || '0m'} focused
          </Text>
        </Card>

        <SectionTitle>Weekly velocity</SectionTitle>
        <Card style={{ marginBottom: spacing(2) }}>
          <View style={styles.barChart}>
            {series.weeks.map((w, i) => {
              const h = (w.completed / maxVel) * 90 + 2;
              return (
                <View key={i} style={styles.barCol}>
                  <View style={styles.barTrackArea}>
                    <View style={[styles.barDone, { height: h, backgroundColor: colors.primary }]} />
                  </View>
                  <Text style={styles.barLabel}>{w.label}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.heatSummary}>Tasks completed per week (last {series.weeks.length} weeks)</Text>
        </Card>

        <SectionTitle>Completion rate trend</SectionTitle>
        <Card style={{ marginBottom: spacing(2) }}>
          {series.weeks.length === 0 ? (
            <Text style={styles.dim}>No data yet.</Text>
          ) : (
            series.weeks.slice(-8).map((w) => (
              <View key={w.weekStart} style={[styles.catRow, { marginBottom: spacing(1) }]}>
                <View style={styles.catHeader}>
                  <Text style={styles.catName}>Week of {w.label}</Text>
                  <Text style={styles.catCount}>{Math.round(w.rate * 100)}%</Text>
                </View>
                <ProgressBar value={w.rate} color={colors.success} />
              </View>
            ))
          )}
        </Card>

        <SectionTitle>Last 7 days</SectionTitle>
        <Card style={{ marginBottom: spacing(2) }}>
          <View style={styles.barChart}>
            {stats.week.map((w, i) => {
              const h = (w.done / maxWeek) * 90 + 2;
              const ht = (w.total / maxWeek) * 90 + 2;
              return (
                <View key={i} style={styles.barCol}>
                  <View style={styles.barTrackArea}>
                    <View style={[styles.barTotal, { height: ht }]} />
                    <View style={[styles.barDone, { height: h }]} />
                  </View>
                  <Text style={styles.barLabel}>{w.label}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={styles.legendText}>Completed</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.surfaceAlt }]} />
              <Text style={styles.legendText}>Scheduled</Text>
            </View>
          </View>
        </Card>

        <SectionTitle>When you finish things</SectionTitle>
        <Card style={{ marginBottom: spacing(2) }}>
          <HourlyHistogram data={hourStats} accent={colors.success} focusAccent={learnAccent} />
        </Card>

        <SectionTitle>By category ({rangeDays}d)</SectionTitle>
        <Card style={{ marginBottom: spacing(2) }}>
          {stats.byCat.every((b) => b.total === 0) ? (
            <Text style={styles.dim}>No activity yet.</Text>
          ) : (
            stats.byCat.map((b) => (
              <View key={b.category.id} style={styles.catRow}>
                <View style={styles.catHeader}>
                  <View style={[styles.dot, { backgroundColor: b.category.color }]} />
                  <Text style={styles.catName}>{b.category.name}</Text>
                  <Text style={styles.catCount}>
                    {b.done}/{b.total}{b.skipped > 0 ? ` · ${b.skipped} skipped` : ''}
                  </Text>
                </View>
                <ProgressBar value={b.total ? b.done / b.total : 0} color={b.category.color} />
              </View>
            ))
          )}
        </Card>

        <SectionTitle>By tag ({rangeDays}d)</SectionTitle>
        <Card style={{ marginBottom: spacing(2) }}>
          {tagStats.length === 0 ? (
            <Text style={styles.dim}>Add #tags to your tasks to see a breakdown.</Text>
          ) : (
            tagStats.map((t) => (
              <View key={t.tag} style={styles.catRow}>
                <View style={styles.catHeader}>
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.catName} numberOfLines={1}>
                    #{t.tag}
                  </Text>
                  <Text style={styles.catCount}>
                    {t.done}/{t.total} · {Math.round(t.rate * 100)}%
                  </Text>
                </View>
                <ProgressBar value={t.rate} color={colors.primary} />
              </View>
            ))
          )}
        </Card>

        <SectionTitle>Habits / recurring ({rangeDays}d)</SectionTitle>
        <Card style={{ marginBottom: spacing(2) }}>
          <HabitAdherenceList habits={habits} />
        </Card>

        <SectionTitle>Goal progress</SectionTitle>
        <GoalProgressList goals={goals} />
        <View style={{ height: spacing(2) }} />

        <SectionTitle>Focus & study</SectionTitle>
        <View style={styles.kpiRow}>
          <Kpi label="Study streak" value={`${stats.studyStreakVal}🔥`} color={colors.warning} />
          <Kpi label="Focused (7d)" value={prettyDuration(stats.focusWeek) || '0m'} color={learnAccent} />
        </View>
        <Card style={{ marginBottom: spacing(2) }}>
          <View style={styles.catHeader}>
            <Text style={styles.catName}>Total focus time</Text>
            <Text style={styles.catCount}>{prettyDuration(stats.focusTotal) || '0m'}</Text>
          </View>
          {stats.byGoal.length === 0 ? (
            <Text style={styles.dim}>Use the focus timer or log study sessions to track time per goal.</Text>
          ) : (
            stats.byGoal.map((b) => (
              <View key={b.goal.id} style={[styles.catRow, { marginTop: spacing(1) }]}>
                <View style={styles.catHeader}>
                  <Text style={styles.catName} numberOfLines={1}>
                    {b.goal.title}
                  </Text>
                  <Text style={styles.catCount}>{prettyDuration(b.minutes)}</Text>
                </View>
                <ProgressBar value={b.minutes / stats.maxGoalMin} color={learnAccent} />
              </View>
            ))
          )}
        </Card>

        <SectionTitle>Export & import</SectionTitle>
        <Card style={{ marginBottom: spacing(2) }}>
          <Text style={styles.dim}>Back up your data or move it between devices.</Text>
          <View style={styles.ioRow}>
            <Button title="⬇ Tasks CSV" small variant="ghost" style={{ flex: 1 }} onPress={onExportTasks} />
            <Button title="⬇ Focus CSV" small variant="ghost" style={{ flex: 1 }} onPress={onExportSessions} />
          </View>
          <View style={styles.ioRow}>
            <Button title="🧾 PDF report" small variant="ghost" style={{ flex: 1 }} onPress={onExportPdf} />
            <Button title="⬆ Import CSV" small style={{ flex: 1 }} onPress={onImport} />
          </View>
          {!isWeb ? <Text style={styles.ioHint}>PDF & import work in the web app.</Text> : null}
        </Card>

        <View style={{ height: spacing(4) }} />
      </ScrollView>
    </View>
  );
}

function buildReportHtml(
  stats: { doneToday: number; totalToday: number; msDone: number; msTotal: number; focusTotal: number; byCat: { category: { name: string }; total: number; done: number }[] },
  series: { totals: { completed: number; scheduled: number; rate: number; focusMin: number; activeDays: number }; streak: number; best: number },
  rangeDays: number,
): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const dur = (m: number) => {
    if (!m) return '0m';
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return h ? `${h}h ${mm}m` : `${mm}m`;
  };
  const catRows = stats.byCat
    .filter((b) => b.total > 0)
    .map(
      (b) =>
        `<tr><td>${escapeHtml(b.category.name)}</td><td>${b.done}/${b.total}</td><td>${pct(
          b.total ? b.done / b.total : 0,
        )}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>To Do report</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;padding:32px;max-width:720px;margin:auto}
  h1{margin:0 0 4px} .sub{color:#666;margin-bottom:24px}
  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px}
  .kpi{border:1px solid #e2e2e2;border-radius:10px;padding:14px}
  .kpi .v{font-size:26px;font-weight:800} .kpi .l{color:#666;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{text-align:left;padding:8px;border-bottom:1px solid #eee;font-size:14px}
  th{color:#666;font-weight:600}
</style></head><body>
  <h1>To Do report</h1>
  <div class="sub">Generated ${new Date().toLocaleString()} · Range ${rangeDays} day${rangeDays === 1 ? '' : 's'}</div>
  <div class="grid">
    <div class="kpi"><div class="v">${pct(series.totals.rate)}</div><div class="l">Completion rate (range)</div></div>
    <div class="kpi"><div class="v">${series.streak}🔥</div><div class="l">Current streak (best ${series.best}d)</div></div>
    <div class="kpi"><div class="v">${series.totals.completed}/${series.totals.scheduled}</div><div class="l">Completed in range</div></div>
    <div class="kpi"><div class="v">${dur(series.totals.focusMin)}</div><div class="l">Focus time in range</div></div>
    <div class="kpi"><div class="v">${stats.msDone}/${stats.msTotal}</div><div class="l">Milestones completed</div></div>
    <div class="kpi"><div class="v">${series.totals.activeDays}</div><div class="l">Active days in range</div></div>
  </div>
  <h3>By category (range)</h3>
  <table><thead><tr><th>Category</th><th>Done</th><th>Rate</th></tr></thead><tbody>${
    catRows || '<tr><td colspan="3">No activity</td></tr>'
  }</tbody></table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

function Kpi({
  label,
  value,
  color,
  delta,
}: {
  label: string;
  value: string;
  color: string;
  delta?: Delta | null;
}) {
  const styles = useThemedStyles(makeStyles);
  const colors = useTheme();
  let deltaNode: React.ReactNode = null;
  if (delta) {
    const txt = formatDelta(delta);
    let dColor: string = colors.textDim;
    if (delta.delta > 0) dColor = colors.success;
    else if (delta.delta < 0) dColor = colors.danger;
    deltaNode = <Text style={[styles.kpiDelta, { color: dColor }]}>{txt}</Text>;
  }
  return (
    <Card style={styles.kpi}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {deltaNode}
    </Card>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(2) },
  notice: {
    backgroundColor: colors.primaryDim,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing(1.25),
    marginBottom: spacing(1.5),
  },
  noticeText: { color: colors.text, fontSize: 13, fontFamily },
  kpiRow: { flexDirection: 'row', gap: spacing(1.5), marginBottom: spacing(1.5) },
  kpi: { flex: 1 },
  kpiValue: { fontSize: 24, fontWeight: '900' },
  kpiLabel: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  kpiDelta: { fontSize: 11, fontWeight: '700', marginTop: 4, fontFamily },
  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1), marginBottom: spacing(1) },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    marginBottom: spacing(1),
  },
  customInputWrap: { flex: 1 },
  customInput: {
    flex: 1,
    marginBottom: 0,
    paddingVertical: spacing(0.75),
    paddingHorizontal: spacing(1.25),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily,
    fontSize: 13,
  },
  customSep: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  dateError: { color: colors.danger, fontSize: 12, marginBottom: spacing(1), fontFamily },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(1),
    marginBottom: spacing(1),
  },
  compareToggle: {
    paddingVertical: spacing(0.75),
    paddingHorizontal: spacing(1.5),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  compareToggleOn: { backgroundColor: colors.primary + '22', borderColor: colors.primary },
  compareToggleText: { color: colors.textDim, fontSize: 12, fontWeight: '700', fontFamily },
  compareToggleTextOn: { color: colors.primary },
  rangeSummary: { color: colors.textDim, fontSize: 12, fontFamily, flexShrink: 1, textAlign: 'right' },
  compareSub: { color: colors.textFaint, fontSize: 11, marginBottom: spacing(1.5), fontFamily },
  rangeChip: {
    paddingVertical: spacing(0.75),
    paddingHorizontal: spacing(1.75),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rangeChipActive: { backgroundColor: colors.primary + '22', borderColor: colors.primary },
  rangeText: { color: colors.textDim, fontSize: 13, fontWeight: '600', fontFamily },
  rangeTextActive: { color: colors.primary, fontWeight: '800' },
  heatSummary: { color: colors.textDim, fontSize: 12, marginTop: spacing(1), fontFamily },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 110, justifyContent: 'space-between' },
  barCol: { flex: 1, alignItems: 'center' },
  barTrackArea: { height: 92, justifyContent: 'flex-end', width: 22 },
  barTotal: { position: 'absolute', bottom: 0, width: 22, backgroundColor: colors.surfaceAlt, borderRadius: 5 },
  barDone: { width: 22, backgroundColor: colors.success, borderRadius: 5 },
  barLabel: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: spacing(2), marginTop: spacing(1.5) },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 3, marginRight: 5 },
  legendText: { color: colors.textDim, fontSize: 12 },
  catRow: { marginBottom: spacing(1.5) },
  catHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing(0.75) },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  catName: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  catCount: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  dim: { color: colors.textDim, fontSize: 13 },
  ioRow: { flexDirection: 'row', gap: spacing(1), marginTop: spacing(1.25) },
  ioHint: { color: colors.textFaint, fontSize: 12, marginTop: spacing(1), fontFamily },
});
