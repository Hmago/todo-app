import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  Platform,
  StatusBar as RNStatusBar,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { spacing, fontFamily, useThemedStyles, Palette } from './src/theme';
import { ThemeProvider, useResolvedTheme } from './src/components/ThemeProvider';
import { HomeScreen, Route } from './src/screens/HomeScreen';
import { MyDayScreen } from './src/screens/MyDayScreen';
import { ImportantScreen } from './src/screens/ImportantScreen';
import { PlannedScreen } from './src/screens/PlannedScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { LearningScreen } from './src/screens/LearningScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { MotivationScreen } from './src/screens/MotivationScreen';
import { DailyLogScreen } from './src/screens/DailyLogScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AllTasksScreen, CategoryScreen } from './src/screens/ListScreen';
import { TaskEditorModal } from './src/components/TaskEditorModal';
import { Sidebar, NavKey } from './src/components/Sidebar';
import ReminderBanner from './src/components/ReminderBanner';
import { OnboardingOverlay } from './src/components/OnboardingOverlay';
import { UndoToast } from './src/components/UndoToast';
import { useReminders } from './src/lib/useReminders';
import { initNotifications } from './src/lib/notifications';
import { registerPWA } from './src/lib/pwa';
import { useUI } from './src/store/useUI';
import { useStore } from './src/store/useStore';
import { useHistory } from './src/store/useHistory';

type Tab = 'home' | 'myday' | 'important' | 'planned' | 'calendar';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: 'Lists', icon: '☰' },
  { key: 'myday', label: 'My Day', icon: '☀️' },
  { key: 'important', label: 'Important', icon: '⭐' },
  { key: 'planned', label: 'Planned', icon: '🗓️' },
  { key: 'calendar', label: 'Calendar', icon: '📅' },
];

const DESKTOP_MIN = 820;

function AppInner() {
  const [tab, setTab] = useState<Tab>('home');
  const [sub, setSub] = useState<Route | null>(null);
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_MIN;
  const styles = useThemedStyles(makeStyles);
  const { isDark } = useResolvedTheme();
  const statusBarStyle = isDark ? 'light' : 'dark';

  const editorVisible = useUI((s) => s.editorVisible);
  const editing = useUI((s) => s.editing);
  const seed = useUI((s) => s.seed);
  const closeEditor = useUI((s) => s.closeEditor);

  const reminders = useReminders();

  useEffect(() => {
    initNotifications();
    registerPWA();
  }, []);

  // Global Ctrl/Cmd+Z (undo) and Ctrl+Shift+Z / Ctrl+Y (redo). Skipped when
  // focus is inside an editable element so the browser/text-input native undo
  // continues to work for in-progress edits.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      const isRedo = (key === 'z' && e.shiftKey) || key === 'y';
      const isUndo = key === 'z' && !e.shiftKey;
      if (!isUndo && !isRedo) return;
      e.preventDefault();
      const cur = useStore.getState().tasks;
      const entry = isRedo
        ? useHistory.getState().popRedo(cur)
        : useHistory.getState().popUndo(cur);
      if (entry) useStore.setState({ tasks: entry.tasks });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const goTab = useCallback((t: Tab) => {
    setSub(null);
    setTab(t);
  }, []);
  const back = useCallback(() => setSub(null), []);

  const select = useCallback((key: NavKey) => {
    if (key === 'myday' || key === 'important' || key === 'planned' || key === 'calendar') {
      setSub(null);
      setTab(key);
    } else {
      setSub(key as Route);
    }
  }, []);

  const activeKey: NavKey = sub
    ? (sub as NavKey)
    : tab === 'home'
    ? 'myday'
    : (tab as NavKey);

  const renderContent = (desktop: boolean) => {
    const onBack = desktop ? undefined : back;
    if (sub) {
      if (sub.startsWith('category:')) {
        return <CategoryScreen categoryId={sub.slice('category:'.length)} onBack={onBack} />;
      }
      switch (sub) {
        case 'tasks':
          return <AllTasksScreen onBack={onBack} />;
        case 'learning':
          return <LearningScreen onBack={onBack} />;
        case 'analytics':
          return <AnalyticsScreen onBack={onBack} />;
        case 'motivation':
          return <MotivationScreen onBack={onBack} />;
        case 'log':
          return <DailyLogScreen onBack={onBack} />;
        case 'search':
          return <SearchScreen onBack={onBack} />;
        case 'settings':
          return <SettingsScreen onBack={onBack} />;
      }
    }
    const effTab = desktop && tab === 'home' ? 'myday' : tab;
    switch (effTab) {
      case 'home':
        return <HomeScreen onNavigate={setSub} onOpenSmart={goTab} />;
      case 'myday':
        return <MyDayScreen />;
      case 'important':
        return <ImportantScreen />;
      case 'planned':
        return <PlannedScreen />;
      case 'calendar':
        return <CalendarScreen />;
    }
  };

  if (isDesktop) {
    return (
      <SafeAreaView style={styles.root} nativeID="app-root">
      <StatusBar style={statusBarStyle} />
        <View style={styles.desktopRow}>
          <Sidebar active={activeKey} onSelect={select} />
          <View style={styles.desktopContent}>{renderContent(true)}</View>
        </View>
        <TaskEditorModal visible={editorVisible} editing={editing} seed={seed} onClose={closeEditor} />
        <ReminderBanner {...reminders} />
        <UndoToast />
        <OnboardingOverlay />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} nativeID="app-root">
      <StatusBar style={statusBarStyle} />
      {tab === 'home' && !sub ? (
        <View style={styles.homeHeader}>
          <Text style={styles.brand}>To Do</Text>
        </View>
      ) : null}

      <View style={styles.body}>{renderContent(false)}</View>

      <View style={styles.tabbar} nativeID="app-tabbar">
        {TABS.map((t) => {
          const active = !sub && t.key === tab;
          return (
            <Pressable key={t.key} style={styles.tab} onPress={() => goTab(t.key)} hitSlop={6}>
              <Text style={[styles.tabIcon, !active && styles.tabInactive]}>{t.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <TaskEditorModal visible={editorVisible} editing={editing} seed={seed} onClose={closeEditor} />
      <ReminderBanner {...reminders} />
      <UndoToast />
      <OnboardingOverlay />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  desktopRow: { flex: 1, flexDirection: 'row' },
  desktopContent: { flex: 1, backgroundColor: colors.bg },
  homeHeader: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing(2),
    paddingTop: spacing(1),
    paddingBottom: spacing(1),
  },
  brand: { color: colors.primary, fontSize: 22, fontWeight: '800', fontFamily },
  body: { flex: 1, backgroundColor: colors.bg },
  tabbar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.sidebar,
    paddingBottom: Platform.OS === 'ios' ? spacing(1) : 0,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing(1.25), minHeight: 54 },
  tabIcon: { fontSize: 22 },
  tabInactive: { opacity: 0.45 },
  tabLabel: { color: colors.textDim, fontSize: 11, marginTop: 3, fontWeight: '600', fontFamily },
  tabLabelActive: { color: colors.primary },
});
