import React, { useState, useEffect } from 'react';
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
import { colors, spacing, fontFamily } from './src/theme';
import { HomeScreen, Route } from './src/screens/HomeScreen';
import { MyDayScreen } from './src/screens/MyDayScreen';
import { ImportantScreen } from './src/screens/ImportantScreen';
import { PlannedScreen } from './src/screens/PlannedScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { LearningScreen } from './src/screens/LearningScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { DailyLogScreen } from './src/screens/DailyLogScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AllTasksScreen, CategoryScreen } from './src/screens/ListScreen';
import { TaskEditorModal } from './src/components/TaskEditorModal';
import { Sidebar, NavKey } from './src/components/Sidebar';
import ReminderBanner from './src/components/ReminderBanner';
import { OnboardingOverlay } from './src/components/OnboardingOverlay';
import { useReminders } from './src/lib/useReminders';
import { initNotifications } from './src/lib/notifications';
import { registerPWA } from './src/lib/pwa';
import { useUI } from './src/store/useUI';

type Tab = 'home' | 'myday' | 'important' | 'planned' | 'calendar';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: 'Lists', icon: '☰' },
  { key: 'myday', label: 'My Day', icon: '☀️' },
  { key: 'important', label: 'Important', icon: '⭐' },
  { key: 'planned', label: 'Planned', icon: '🗓️' },
  { key: 'calendar', label: 'Calendar', icon: '📅' },
];

const DESKTOP_MIN = 820;

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [sub, setSub] = useState<Route | null>(null);
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_MIN;

  const editorVisible = useUI((s) => s.editorVisible);
  const editing = useUI((s) => s.editing);
  const seed = useUI((s) => s.seed);
  const closeEditor = useUI((s) => s.closeEditor);

  const reminders = useReminders();

  useEffect(() => {
    initNotifications();
    registerPWA();
  }, []);

  const goTab = (t: Tab) => {
    setSub(null);
    setTab(t);
  };
  const back = () => setSub(null);

  const select = (key: NavKey) => {
    if (key === 'myday' || key === 'important' || key === 'planned' || key === 'calendar') {
      setSub(null);
      setTab(key);
    } else {
      setSub(key as Route);
    }
  };

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
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.desktopRow}>
          <Sidebar active={activeKey} onSelect={select} />
          <View style={styles.desktopContent}>{renderContent(true)}</View>
        </View>
        <TaskEditorModal visible={editorVisible} editing={editing} seed={seed} onClose={closeEditor} />
        <ReminderBanner {...reminders} />
        <OnboardingOverlay />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      {tab === 'home' && !sub ? (
        <View style={styles.homeHeader}>
          <Text style={styles.brand}>To Do</Text>
        </View>
      ) : null}

      <View style={styles.body}>{renderContent(false)}</View>

      <View style={styles.tabbar}>
        {TABS.map((t) => {
          const active = !sub && t.key === tab;
          return (
            <Pressable key={t.key} style={styles.tab} onPress={() => goTab(t.key)}>
              <Text style={[styles.tabIcon, !active && styles.tabInactive]}>{t.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <TaskEditorModal visible={editorVisible} editing={editing} seed={seed} onClose={closeEditor} />
      <ReminderBanner {...reminders} />
      <OnboardingOverlay />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing(1) },
  tabIcon: { fontSize: 20 },
  tabInactive: { opacity: 0.45 },
  tabLabel: { color: colors.textDim, fontSize: 10, marginTop: 2, fontWeight: '600', fontFamily },
  tabLabelActive: { color: colors.primary },
});
