import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Switch } from 'react-native';
import { AppModal } from '../components/AppModal';
import { radius, spacing, fontFamily, shadow, CATEGORY_COLORS, useTheme, useThemedStyles, Palette } from '../theme';
import { useStore } from '../store/useStore';
import { Category } from '../types';
import { useSettings } from '../store/useSettings';
import { useOnboarding } from '../store/useOnboarding';
import { useThemePref } from '../store/useThemePref';
import type { ThemeMode } from '../theme';
import { ListHeader } from '../components/ListHeader';
import { Button, Card, EmptyState, SectionTitle } from '../components/ui';
import {
  exportBackup,
  parseBackup,
  applyBackup,
  pickJsonFile,
  canPickFile,
  Backup,
  BackupSummary,
} from '../lib/backup';
import { initInstallPrompt, promptInstall, isStandalone } from '../lib/pwa';
import { getStorageUsageBytes, formatBytes } from '../lib/storage';
import {
  getPermission,
  requestPermission,
  notificationsSupported,
  PermissionState,
} from '../lib/notifications';
import { DateTimeField } from '../components/DateTimeField';
import { exportDailyLogs, summarizeDailyLogs } from '../lib/logExport';
import { todayKey, toKey, fromKey } from '../lib/dates';
import { addDays, startOfMonth, isValid } from 'date-fns';

function ListRow({
  category,
  count,
  isFirst,
  isLast,
  onMove,
  onUpdate,
  onDelete,
}: {
  category: Category;
  count: number;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: 'up' | 'down') => void;
  onUpdate: (patch: Partial<Category>) => void;
  onDelete: () => void;
}) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Re-seed the rename field and clear the delete confirm whenever the editor
  // opens or the category changes underneath us.
  useEffect(() => {
    if (editing) {
      setName(category.name);
      setConfirmDelete(false);
    }
  }, [editing, category.name]);

  const commitName = () => {
    const n = name.trim();
    if (n && n !== category.name) onUpdate({ name: n });
    else setName(category.name);
  };

  return (
    <View style={styles.listCard}>
      <View style={styles.listRowTop}>
        <View style={[styles.dot, { backgroundColor: category.color }]} />
        <Text style={styles.catName} numberOfLines={1}>{category.name}</Text>
        <Text style={styles.catCount}>{count} task{count === 1 ? '' : 's'}</Text>
        <View style={styles.listReorder}>
          <Pressable
            onPress={() => onMove('up')}
            disabled={isFirst}
            hitSlop={6}
            style={styles.reorderBtn}
            accessibilityLabel="Move list up"
          >
            <Text style={[styles.reorderIcon, isFirst && styles.reorderDisabled]}>▲</Text>
          </Pressable>
          <Pressable
            onPress={() => onMove('down')}
            disabled={isLast}
            hitSlop={6}
            style={styles.reorderBtn}
            accessibilityLabel="Move list down"
          >
            <Text style={[styles.reorderIcon, isLast && styles.reorderDisabled]}>▼</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => setEditing((v) => !v)}
          hitSlop={8}
          accessibilityLabel={`Edit list ${category.name}`}
        >
          <Text style={styles.editLink}>{editing ? 'Close' : 'Edit'}</Text>
        </Pressable>
      </View>

      {editing ? (
        <View style={styles.listEditor}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="List name"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            onBlur={commitName}
            onSubmitEditing={commitName}
            returnKeyType="done"
          />
          <View style={styles.swatchRow}>
            {CATEGORY_COLORS.map((col) => (
              <Pressable
                key={col}
                onPress={() => onUpdate({ color: col })}
                style={[styles.swatch, { backgroundColor: col }, category.color === col && styles.swatchActive]}
                accessibilityLabel={`Set list color`}
              />
            ))}
          </View>
          <View style={styles.listEditorActions}>
            <Pressable
              onPress={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
              hitSlop={6}
              accessibilityLabel={`Delete list ${category.name}`}
            >
              <Text style={styles.delete}>{confirmDelete ? 'Confirm delete?' : 'Delete list'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

type LogRangeKey = '7d' | '30d' | 'mtd' | 'all' | 'custom';
const LOG_RANGES: { key: LogRangeKey; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'mtd', label: 'This month' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function validLogDate(s: string): boolean {
  return ISO_DATE_RE.test(s) && isValid(fromKey(s));
}

export function SettingsScreen({ onBack }: { onBack?: () => void }) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const categories = useStore((s) => s.categories);
  const tasks = useStore((s) => s.tasks);
  const logs = useStore((s) => s.logs);
  const addCategory = useStore((s) => s.addCategory);
  const updateCategory = useStore((s) => s.updateCategory);
  const moveCategory = useStore((s) => s.moveCategory);
  const deleteCategory = useStore((s) => s.deleteCategory);
  const settings = useSettings();
  const themeMode = useThemePref((s) => s.mode);
  const setThemeMode = useThemePref((s) => s.setMode);
  const replayTour = useOnboarding((s) => s.replay);

  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [perm, setPerm] = useState<PermissionState>(getPermission());

  // Backup & restore
  const [pending, setPending] = useState<{ backup: Backup; summary: BackupSummary } | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [dataMsg, setDataMsg] = useState<string | null>(null);

  // Daily log export
  const [logRange, setLogRange] = useState<LogRangeKey>('30d');
  const [logFrom, setLogFrom] = useState(() => toKey(addDays(new Date(), -29)));
  const [logTo, setLogTo] = useState(() => todayKey());
  const [logMsg, setLogMsg] = useState<string | null>(null);

  // PWA install
  const [installAvailable, setInstallAvailable] = useState(false);
  const [installed, setInstalled] = useState(isStandalone());
  useEffect(() => initInstallPrompt(setInstallAvailable), []);

  // Storage usage. Measured from the persisted stores and refreshed whenever the
  // amount of data changes (e.g. after an import, or adding/removing a list).
  const [storageBytes, setStorageBytes] = useState<number | null>(null);
  const goalCount = useStore((s) => s.goals.length);
  const logCount = useStore((s) => s.logs.length);
  const sessionCount = useStore((s) => s.studySessions.length);
  useEffect(() => {
    let cancelled = false;
    // Give the debounced persist (~250ms) time to flush so the figure reflects
    // the latest data when something changed while Settings is open.
    const t = setTimeout(() => {
      getStorageUsageBytes().then((b) => {
        if (!cancelled) setStorageBytes(b);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [tasks.length, categories.length, goalCount, logCount, sessionCount]);

  const onInstall = async () => {
    const res = await promptInstall();
    if (res === 'accepted') {
      setInstalled(true);
      setInstallAvailable(false);
    }
  };

  const flashData = (m: string) => {
    setDataMsg(m);
    setTimeout(() => setDataMsg((cur) => (cur === m ? null : cur)), 4000);
  };

  const flashLog = (m: string) => {
    setLogMsg(m);
    setTimeout(() => setLogMsg((cur) => (cur === m ? null : cur)), 4000);
  };

  const logRangeValid = validLogDate(logFrom) && validLogDate(logTo) && logFrom <= logTo;

  const logSummary = useMemo(
    () => (logRangeValid ? summarizeDailyLogs({ from: logFrom, to: logTo, logs, tasks }) : null),
    [logRangeValid, logFrom, logTo, logs, tasks],
  );

  const applyLogRange = (key: LogRangeKey) => {
    setLogRange(key);
    const today = todayKey();
    if (key === '7d') {
      setLogFrom(toKey(addDays(new Date(), -6)));
      setLogTo(today);
    } else if (key === '30d') {
      setLogFrom(toKey(addDays(new Date(), -29)));
      setLogTo(today);
    } else if (key === 'mtd') {
      setLogFrom(toKey(startOfMonth(new Date())));
      setLogTo(today);
    } else if (key === 'all') {
      const dates: string[] = [];
      for (const l of logs) dates.push(l.date);
      for (const t of tasks) for (const d of t.completedDates) dates.push(d);
      setLogFrom(dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : today);
      setLogTo(today);
    }
    // 'custom' keeps the current From/To values.
  };

  const onExportLogs = () => {
    if (!logRangeValid) {
      flashLog('Enter valid dates as YYYY-MM-DD (from ≤ to).');
      return;
    }
    const r = exportDailyLogs(logFrom, logTo);
    if (r.logCount + r.taskCount + r.missedCount + r.skippedCount === 0) {
      flashLog('No activity in that range.');
      return;
    }
    const verb = canPickFile ? 'Downloaded' : 'Ready to share';
    const extra =
      (r.missedCount > 0 ? `, ${r.missedCount} missed` : '') +
      (r.skippedCount > 0 ? `, ${r.skippedCount} skipped` : '');
    flashLog(
      `${verb}: ${r.activeDays} day${r.activeDays === 1 ? '' : 's'}, ` +
        `${r.logCount} log${r.logCount === 1 ? '' : 's'}, ` +
        `${r.taskCount} task${r.taskCount === 1 ? '' : 's'}${extra}.`,
    );
  };

  const reviewText = (text: string | null) => {
    if (!text) return;
    const res = parseBackup(text);
    if (!res.ok || !res.backup || !res.summary) {
      flashData(res.error ?? 'Could not read that backup.');
      return;
    }
    setPending({ backup: res.backup, summary: res.summary });
  };

  const onExport = () => {
    exportBackup();
    flashData(canPickFile ? 'Backup downloaded.' : 'Backup ready to share.');
  };

  const onImport = async () => {
    if (canPickFile) {
      const text = await pickJsonFile();
      reviewText(text);
    } else {
      setPasteText('');
      setPasteOpen(true);
    }
  };

  const confirmRestore = () => {
    if (!pending) return;
    applyBackup(pending.backup);
    const s = pending.summary;
    setPending(null);
    flashData(`Restored ${s.tasks} tasks, ${s.categories} lists, ${s.goals} goals.`);
  };

  const enableNotifications = async () => {
    const res = await requestPermission();
    setPerm(res);
  };

  const permLabel: Record<PermissionState, string> = {
    granted: '✅ Notifications enabled',
    denied: '🔕 Blocked — enable them in your browser settings',
    default: 'Not enabled yet',
    unsupported: 'OS notifications aren’t supported here (in-app reminders still work)',
  };

  const add = () => {
    if (!name.trim()) return;
    addCategory(name.trim(), color);
    setName('');
    setColor(CATEGORY_COLORS[(CATEGORY_COLORS.indexOf(color) + 1) % CATEGORY_COLORS.length]);
  };

  return (
    <View style={styles.screen}>
      <ListHeader themeKey="settings" icon="⚙️" title="Lists & settings" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionTitle>Appearance</SectionTitle>
        <Card style={{ marginBottom: spacing(2) }}>
          <Text style={styles.toggleTitle}>Theme</Text>
          <Text style={[styles.permStatus, { marginBottom: spacing(1.5) }]}>
            Choose light, dark, or follow your device.
          </Text>
          <View style={styles.segWrap}>
            {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => {
              const active = themeMode === m;
              const label = m === 'system' ? '⚙️ System' : m === 'light' ? '☀️ Light' : '🌙 Dark';
              return (
                <Pressable
                  key={m}
                  onPress={() => setThemeMode(m)}
                  style={[styles.segBtn, active && styles.segBtnActive]}
                >
                  <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <SectionTitle>Notifications</SectionTitle>
        <Card style={{ marginBottom: spacing(2) }}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Enable reminders</Text>
              <Text style={styles.permStatus}>{permLabel[perm]}</Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={settings.setEnabled}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
          {notificationsSupported() && perm !== 'granted' && perm !== 'denied' ? (
            <Button title="Enable notifications" small onPress={enableNotifications} />
          ) : null}

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Daily agenda</Text>
              <Text style={styles.toggleSub}>A morning summary of today’s tasks</Text>
            </View>
            <Switch
              value={settings.agendaEnabled}
              onValueChange={settings.setAgendaEnabled}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
          {settings.agendaEnabled ? (
            <View style={styles.inlineField}>
              <Text style={styles.fieldLabel}>At</Text>
              <TextInput
                value={settings.agendaTime}
                onChangeText={settings.setAgendaTime}
                placeholder="08:00"
                placeholderTextColor={colors.textDim}
                style={styles.timeInput}
                autoCapitalize="none"
              />
            </View>
          ) : null}

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Quiet hours</Text>
              <Text style={styles.toggleSub}>Silence reminders during this window</Text>
            </View>
            <Switch
              value={settings.quietHoursEnabled}
              onValueChange={settings.setQuietHoursEnabled}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
          {settings.quietHoursEnabled ? (
            <View style={styles.inlineField}>
              <Text style={styles.fieldLabel}>From</Text>
              <TextInput
                value={settings.quietStart}
                onChangeText={(v) => settings.setQuietHours(v, settings.quietEnd)}
                placeholder="22:00"
                placeholderTextColor={colors.textDim}
                style={styles.timeInput}
                autoCapitalize="none"
              />
              <Text style={styles.fieldLabel}>to</Text>
              <TextInput
                value={settings.quietEnd}
                onChangeText={(v) => settings.setQuietHours(settings.quietStart, v)}
                placeholder="07:00"
                placeholderTextColor={colors.textDim}
                style={styles.timeInput}
                autoCapitalize="none"
              />
            </View>
          ) : null}

          {categories.length > 0 ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.toggleTitle}>Muted lists</Text>
              <Text style={styles.toggleSub}>Tap a list to silence its reminders</Text>
              <View style={styles.muteWrap}>
                {categories.map((c) => {
                  const muted = settings.mutedCategories.includes(c.id);
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => settings.toggleCategoryMuted(c.id)}
                      style={[styles.mutePill, muted && styles.mutePillOn]}
                    >
                      <View style={[styles.dot, { backgroundColor: c.color, marginRight: spacing(0.75) }]} />
                      <Text style={[styles.mutePillText, muted && styles.mutePillTextOn]}>
                        {muted ? '🔕 ' : ''}{c.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </Card>

        <SectionTitle>New list</SectionTitle>
        <Card style={{ marginBottom: spacing(2) }}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="List / category name"
            placeholderTextColor={colors.textDim}
            style={styles.input}
          />
          <View style={styles.swatchRow}>
            {CATEGORY_COLORS.map((c) => (
              <Pressable key={c} onPress={() => setColor(c)} style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]} />
            ))}
          </View>
          <Button title="Create list" small onPress={add} />
        </Card>

        <SectionTitle>Your lists</SectionTitle>
        {categories.length === 0 ? (
          <EmptyState icon="📋" title="No lists yet" />
        ) : (
          categories.map((c, i) => (
            <ListRow
              key={c.id}
              category={c}
              count={tasks.filter((t) => t.categoryId === c.id).length}
              isFirst={i === 0}
              isLast={i === categories.length - 1}
              onMove={(dir) => moveCategory(c.id, dir)}
              onUpdate={(patch) => updateCategory(c.id, patch)}
              onDelete={() => deleteCategory(c.id)}
            />
          ))
        )}

        <SectionTitle>About</SectionTitle>
        <Card>
          <Text style={styles.aboutTitle}>To Do</Text>
          <Text style={styles.aboutText}>
            A cross-platform todo & learning planner inspired by Microsoft To Do. Smart lists,
            recurring tasks, calendar, important star, search and analytics — stored locally on your device.
          </Text>
          <Text style={styles.aboutMeta}>Runs on iOS and web from one codebase.</Text>
          <View style={{ height: spacing(1.5) }} />
          <Button title="Replay tutorial" small onPress={replayTour} />
          {installed ? (
            <Text style={styles.installedNote}>✅ Installed as an app</Text>
          ) : installAvailable ? (
            <>
              <View style={{ height: spacing(1) }} />
              <Button title="⬇ Install app" small onPress={onInstall} />
            </>
          ) : null}
        </Card>

        <SectionTitle>Backup & data</SectionTitle>
        <Card>
          <View style={styles.storageRow}>
            <Text style={styles.storageLabel}>Storage used</Text>
            <Text style={styles.storageValue}>
              {storageBytes == null ? '…' : formatBytes(storageBytes)}
            </Text>
          </View>
          <Text style={styles.aboutText}>
            Export a full backup of your lists, tasks, goals, logs, focus sessions, saved searches and
            settings as a JSON file. Import it on another device or after reinstalling.
          </Text>
          <View style={[styles.btnRow, { marginTop: spacing(1.5) }]}>
            <Button title="⬇ Export backup" small variant="ghost" style={{ flex: 1 }} onPress={onExport} />
            <Button title="⬆ Import backup" small style={{ flex: 1 }} onPress={onImport} />
          </View>
          <Text style={styles.dataHint}>Importing replaces all current data on this device.</Text>
          {dataMsg ? <Text style={styles.dataMsg}>{dataMsg}</Text> : null}
        </Card>

        <SectionTitle>Export daily logs</SectionTitle>
        <Card>
          <Text style={styles.aboutText}>
            Save your daily logs and completed tasks for a date range as a formatted text file,
            neatly segregated day by day. Great for journals, standups or weekly reviews.
          </Text>

          <View style={[styles.rangeRow, { marginTop: spacing(1.5) }]}>
            {LOG_RANGES.map((r) => {
              const active = logRange === r.key;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => applyLogRange(r.key)}
                  style={[styles.rangeBtn, active && styles.rangeBtnActive]}
                >
                  <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.logDateRow}>
            <View style={styles.logDateField}>
              <Text style={styles.logDateLabel}>From</Text>
              <DateTimeField
                mode="date"
                value={logFrom}
                onChange={(v) => {
                  setLogFrom(v);
                  setLogRange('custom');
                }}
                style={styles.logDateInput}
              />
            </View>
            <Text style={styles.logDateSep}>→</Text>
            <View style={styles.logDateField}>
              <Text style={styles.logDateLabel}>To</Text>
              <DateTimeField
                mode="date"
                value={logTo}
                onChange={(v) => {
                  setLogTo(v);
                  setLogRange('custom');
                }}
                min={validLogDate(logFrom) ? logFrom : undefined}
                style={styles.logDateInput}
              />
            </View>
          </View>

          {logRangeValid ? (
            logSummary ? (
              <Text style={styles.dataHint}>
                {logSummary.activeDays} active day{logSummary.activeDays === 1 ? '' : 's'} ·{' '}
                {logSummary.logCount} log{logSummary.logCount === 1 ? '' : 's'} ·{' '}
                {logSummary.taskCount} completed task{logSummary.taskCount === 1 ? '' : 's'}
                {logSummary.missedCount > 0 ? ` · ${logSummary.missedCount} missed` : ''}
                {logSummary.skippedCount > 0 ? ` · ${logSummary.skippedCount} skipped` : ''}{' '}
                in range.
              </Text>
            ) : null
          ) : (
            <Text style={styles.dateErrorText}>Enter valid dates as YYYY-MM-DD (from ≤ to).</Text>
          )}

          <Button
            title="⬇ Export logs (.txt)"
            small
            style={{ marginTop: spacing(1.5) }}
            onPress={onExportLogs}
          />
          {logMsg ? <Text style={styles.dataMsg}>{logMsg}</Text> : null}
        </Card>

        <View style={{ height: spacing(4) }} />
      </ScrollView>

      {/* Paste-to-import (native, where file picking isn't available) */}
      <AppModal visible={pasteOpen} transparent animationType="fade" onRequestClose={() => setPasteOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Paste backup</Text>
            <Text style={styles.modalSub}>Paste the contents of a To Do backup (.json) file.</Text>
            <TextInput
              value={pasteText}
              onChangeText={setPasteText}
              placeholder={'{ "type": "learnplan-backup", … }'}
              placeholderTextColor={colors.textDim}
              style={styles.pasteInput}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.btnRow}>
              <Button title="Cancel" small variant="ghost" style={{ flex: 1 }} onPress={() => setPasteOpen(false)} />
              <Button
                title="Review"
                small
                style={{ flex: 1 }}
                onPress={() => {
                  setPasteOpen(false);
                  reviewText(pasteText.trim());
                }}
              />
            </View>
          </View>
        </View>
      </AppModal>

      {/* Confirm restore */}
      <AppModal visible={!!pending} transparent animationType="fade" onRequestClose={() => setPending(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Restore this backup?</Text>
            {pending ? (
              <Text style={styles.modalSub}>
                This will replace everything on this device with:{'\n'}
                {pending.summary.tasks} tasks · {pending.summary.categories} lists · {pending.summary.goals} goals ·{' '}
                {pending.summary.logs} logs · {pending.summary.studySessions} focus sessions ·{' '}
                {pending.summary.savedFilters} saved searches.
                {'\n\n'}Exported {new Date(pending.backup.exportedAt).toLocaleString()}.
              </Text>
            ) : null}
            <View style={[styles.btnRow, { marginTop: spacing(1) }]}>
              <Button title="Cancel" small variant="ghost" style={{ flex: 1 }} onPress={() => setPending(null)} />
              <Button title="Replace data" small style={{ flex: 1 }} onPress={confirmRestore} />
            </View>
          </View>
        </View>
      </AppModal>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(1.5) },
  segWrap: { flexDirection: 'row', gap: spacing(1) },
  segBtn: {
    flex: 1,
    paddingVertical: spacing(1.25),
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  segBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  segText: { color: colors.textDim, fontSize: 13, fontWeight: '600', fontFamily },
  segTextActive: { color: colors.primary, fontWeight: '800' },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1.25),
    color: colors.text,
    fontSize: 15,
    fontFamily,
    marginBottom: spacing(1.5),
  },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1), marginBottom: spacing(1.5) },
  swatch: { width: 30, height: 30, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.text },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1.5),
    marginBottom: spacing(1),
    ...shadow,
  },
  listRowTop: { flexDirection: 'row', alignItems: 'center' },
  listReorder: { flexDirection: 'row', alignItems: 'center', marginRight: spacing(1) },
  reorderBtn: { paddingHorizontal: spacing(0.5), paddingVertical: 2 },
  reorderIcon: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  reorderDisabled: { opacity: 0.3 },
  editLink: { color: colors.primary, fontSize: 13, fontWeight: '700', fontFamily },
  listEditor: { marginTop: spacing(1.5) },
  listEditorActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  dot: { width: 14, height: 14, borderRadius: 7, marginRight: spacing(1.25) },
  catName: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1, fontFamily },
  catCount: { color: colors.textDim, fontSize: 12, marginRight: spacing(1.5), fontFamily },
  delete: { color: colors.danger, fontSize: 13, fontWeight: '700', fontFamily },
  aboutTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4, fontFamily },
  aboutText: { color: colors.textDim, fontSize: 13, lineHeight: 19, fontFamily },
  aboutMeta: { color: colors.textDim, fontSize: 12, marginTop: spacing(1), fontStyle: 'italic', fontFamily },
  permStatus: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginTop: 2, fontFamily },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(0.5) },
  toggleTitle: { color: colors.text, fontSize: 15, fontWeight: '700', fontFamily },
  toggleSub: { color: colors.textDim, fontSize: 12, marginTop: 2, fontFamily },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing(1.5) },
  inlineField: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), marginTop: spacing(1) },
  fieldLabel: { color: colors.textDim, fontSize: 13, fontFamily },
  timeInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.75),
    color: colors.text,
    fontSize: 15,
    fontFamily,
    minWidth: 72,
    textAlign: 'center',
  },
  muteWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1), marginTop: spacing(1) },
  mutePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.75),
    borderWidth: 1,
    borderColor: 'transparent',
  },
  mutePillOn: { borderColor: colors.danger, backgroundColor: colors.bg },
  mutePillText: { color: colors.text, fontSize: 13, fontWeight: '600', fontFamily },
  mutePillTextOn: { color: colors.danger },
  btnRow: { flexDirection: 'row', gap: spacing(1) },
  dataHint: { color: colors.textDim, fontSize: 12, marginTop: spacing(1), fontStyle: 'italic', fontFamily },
  dataMsg: { color: colors.primary, fontSize: 13, fontWeight: '700', marginTop: spacing(1), fontFamily },
  storageRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing(1.5),
  },
  storageLabel: { color: colors.text, fontSize: 14, fontWeight: '600', fontFamily },
  storageValue: { color: colors.primary, fontSize: 14, fontWeight: '800', fontFamily },
  installedNote: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginTop: spacing(1.5), fontFamily },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(2),
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2.5),
    ...shadow,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '800', fontFamily, marginBottom: spacing(0.5) },
  modalSub: { color: colors.textDim, fontSize: 14, lineHeight: 20, fontFamily, marginBottom: spacing(1.5) },
  pasteInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing(1.5),
    color: colors.text,
    fontSize: 13,
    fontFamily,
    minHeight: 140,
    textAlignVertical: 'top',
    marginBottom: spacing(1.5),
  },
  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1), marginBottom: spacing(1.5) },
  rangeBtn: {
    paddingVertical: spacing(0.75),
    paddingHorizontal: spacing(1.5),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  rangeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  rangeText: { color: colors.textDim, fontSize: 13, fontWeight: '600', fontFamily },
  rangeTextActive: { color: colors.primary, fontWeight: '800' },
  logDateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing(1), marginBottom: spacing(1) },
  logDateField: { flex: 1 },
  logDateLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
    fontFamily,
    marginBottom: spacing(0.5),
  },
  logDateInput: {
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
  logDateSep: { color: colors.textDim, fontSize: 14, fontWeight: '700', paddingBottom: spacing(1) },
  dateErrorText: { color: colors.danger, fontSize: 12, marginTop: spacing(0.5), fontFamily },
});
