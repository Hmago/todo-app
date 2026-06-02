import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Switch, Modal } from 'react-native';
import { radius, spacing, fontFamily, shadow, CATEGORY_COLORS, useTheme, useThemedStyles, Palette } from '../theme';
import { useStore } from '../store/useStore';
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
import {
  getPermission,
  requestPermission,
  notificationsSupported,
  PermissionState,
} from '../lib/notifications';

export function SettingsScreen({ onBack }: { onBack?: () => void }) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const categories = useStore((s) => s.categories);
  const tasks = useStore((s) => s.tasks);
  const addCategory = useStore((s) => s.addCategory);
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

  // PWA install
  const [installAvailable, setInstallAvailable] = useState(false);
  const [installed, setInstalled] = useState(isStandalone());
  useEffect(() => initInstallPrompt(setInstallAvailable), []);

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
          categories.map((c) => {
            const count = tasks.filter((t) => t.categoryId === c.id).length;
            return (
              <View key={c.id} style={styles.catRow}>
                <View style={[styles.dot, { backgroundColor: c.color }]} />
                <Text style={styles.catName}>{c.name}</Text>
                <Text style={styles.catCount}>{count} task{count === 1 ? '' : 's'}</Text>
                <Pressable onPress={() => deleteCategory(c.id)} hitSlop={8}>
                  <Text style={styles.delete}>Delete</Text>
                </Pressable>
              </View>
            );
          })
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
        <View style={{ height: spacing(4) }} />
      </ScrollView>

      {/* Paste-to-import (native, where file picking isn't available) */}
      <Modal visible={pasteOpen} transparent animationType="fade" onRequestClose={() => setPasteOpen(false)}>
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
      </Modal>

      {/* Confirm restore */}
      <Modal visible={!!pending} transparent animationType="fade" onRequestClose={() => setPending(null)}>
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
      </Modal>
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
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1.5),
    marginBottom: spacing(1),
    ...shadow,
  },
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
});
