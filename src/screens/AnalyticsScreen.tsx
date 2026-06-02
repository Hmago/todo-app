import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { colors, radius, spacing, fontFamily, listThemes, CATEGORY_COLORS } from '../theme';
import { useStore } from '../store/useStore';
import { Card, ProgressBar, SectionTitle, Button } from '../components/ui';
import { ListHeader } from '../components/ListHeader';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { todayKey, toKey, prettyDuration } from '../lib/dates';
import { addDays, format } from 'date-fns';
import { occursOn, isOccurrenceDone, expandRange } from '../lib/recurrence';
import { studyActiveDays, studyStreak, totalMinutesSince, minutesForGoal } from '../lib/study';
import {
  dailySeries,
  weeklyFromDaily,
  completionStreak,
  bestStreak,
  seriesTotals,
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

type RangeKey = '30d' | '90d' | '1y';
const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: '1y', label: '1 year', days: 365 },
];

export function AnalyticsScreen({ onBack }: { onBack?: () => void }) {
  const tasks = useStore((s) => s.tasks);
  const categories = useStore((s) => s.categories);
  const goals = useStore((s) => s.goals);
  const studySessions = useStore((s) => s.studySessions);
  const addTask = useStore((s) => s.addTask);
  const addCategory = useStore((s) => s.addCategory);

  const [range, setRange] = useState<RangeKey>('90d');
  const [notice, setNotice] = useState<string | null>(null);

  const rangeDays = RANGES.find((r) => r.key === range)!.days;

  const stats = useMemo(() => {
    const today = todayKey();
    const start30 = toKey(addDays(new Date(), -29));
    const occ30 = expandRange(tasks, start30, today);
    const total30 = occ30.length;
    const done30 = occ30.filter((o) => isOccurrenceDone(o.task, o.dateKey)).length;

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
      const items = occ30.filter((o) => o.task.categoryId === c.id);
      const cdone = items.filter((o) => isOccurrenceDone(o.task, o.dateKey)).length;
      return { category: c, total: items.length, done: cdone };
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
      rate30: total30 ? done30 / total30 : 0,
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
  }, [tasks, categories, goals, studySessions]);

  const series = useMemo(() => {
    const from = toKey(addDays(new Date(), -(rangeDays - 1)));
    const days = dailySeries(tasks, studySessions, from, todayKey());
    const weeks = weeklyFromDaily(days);
    return {
      days,
      weeks: weeks.slice(-16),
      totals: seriesTotals(days),
      streak: completionStreak(days),
      best: bestStreak(days),
    };
  }, [tasks, studySessions, rangeDays]);

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
    const ok = printHtml(buildReportHtml(stats, series));
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

        <SectionTitle>Overview</SectionTitle>
        <View style={styles.kpiRow}>
          <Kpi label="Done today" value={`${stats.doneToday}/${stats.totalToday}`} color={colors.success} />
          <Kpi label="Streak" value={`${series.streak}🔥`} color={colors.warning} />
        </View>
        <View style={styles.kpiRow}>
          <Kpi label="30-day rate" value={`${Math.round(stats.rate30 * 100)}%`} color={colors.primary} />
          <Kpi label="Best streak" value={`${series.best}d`} color={colors.text} />
        </View>

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

        <SectionTitle>By category (30 days)</SectionTitle>
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
                    {b.done}/{b.total}
                  </Text>
                </View>
                <ProgressBar value={b.total ? b.done / b.total : 0} color={b.category.color} />
              </View>
            ))
          )}
        </Card>

        <SectionTitle>Learning progress</SectionTitle>
        <Card style={{ marginBottom: spacing(2) }}>
          <View style={styles.catHeader}>
            <Text style={styles.catName}>Milestones completed</Text>
            <Text style={styles.catCount}>
              {stats.msDone}/{stats.msTotal}
            </Text>
          </View>
          <ProgressBar value={stats.msTotal ? stats.msDone / stats.msTotal : 0} color={colors.primary} />
        </Card>

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
  stats: { rate30: number; doneToday: number; totalToday: number; msDone: number; msTotal: number; focusTotal: number; byCat: { category: { name: string }; total: number; done: number }[] },
  series: { totals: { completed: number; scheduled: number; rate: number; focusMin: number; activeDays: number }; streak: number; best: number },
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
  <div class="sub">Generated ${new Date().toLocaleString()}</div>
  <div class="grid">
    <div class="kpi"><div class="v">${pct(stats.rate30)}</div><div class="l">30-day completion rate</div></div>
    <div class="kpi"><div class="v">${series.streak}🔥</div><div class="l">Current streak (best ${series.best}d)</div></div>
    <div class="kpi"><div class="v">${series.totals.completed}/${series.totals.scheduled}</div><div class="l">Completed in range</div></div>
    <div class="kpi"><div class="v">${dur(series.totals.focusMin)}</div><div class="l">Focus time in range</div></div>
    <div class="kpi"><div class="v">${stats.msDone}/${stats.msTotal}</div><div class="l">Milestones completed</div></div>
    <div class="kpi"><div class="v">${series.totals.activeDays}</div><div class="l">Active days in range</div></div>
  </div>
  <h3>By category (last 30 days)</h3>
  <table><thead><tr><th>Category</th><th>Done</th><th>Rate</th></tr></thead><tbody>${
    catRows || '<tr><td colspan="3">No activity</td></tr>'
  }</tbody></table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card style={styles.kpi}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
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
  rangeRow: { flexDirection: 'row', gap: spacing(1), marginBottom: spacing(1) },
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
