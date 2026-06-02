import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, spacing, radius, fontFamily, shadow } from '../theme';
import { useOnboarding } from '../store/useOnboarding';

interface Slide {
  icon: string;
  title: string;
  body: string;
  bullets?: string[];
}

const SLIDES: Slide[] = [
  {
    icon: '👋',
    title: 'Welcome to To Do',
    body: 'Your tasks and learning goals in one calm, focused place — works offline on web and iOS.',
  },
  {
    icon: '✍️',
    title: 'Quick-add with natural language',
    body: 'Type a task the way you talk and To Do fills in the details:',
    bullets: [
      'gym tomorrow 6pm  → date + time',
      '!high  /  !!  → priority & important',
      '#health  → tag or list',
      'every monday  → recurring',
    ],
  },
  {
    icon: '🗂️',
    title: 'Organise with lists & smart views',
    body: 'Group work into lists, then jump to My Day, Important, Planned, or the Calendar to see what matters now.',
  },
  {
    icon: '🎓',
    title: 'Plan your learning',
    body: 'Set goals with milestones, log study sessions with the focus timer, and keep a resource library per goal.',
  },
  {
    icon: '📊',
    title: 'See your progress',
    body: 'The Analytics dashboard tracks streaks, completion trends, and an activity heatmap. Swipe rows to complete or delete.',
  },
];

export function OnboardingOverlay() {
  const seen = useOnboarding((s) => s.seen);
  const hydrated = useOnboarding((s) => s.hydrated);
  const complete = useOnboarding((s) => s.complete);
  const [index, setIndex] = useState(0);

  const visible = hydrated && !seen;
  if (!visible) return null;

  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const next = () => (last ? complete() : setIndex((i) => i + 1));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={complete}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Pressable style={styles.skip} onPress={complete} hitSlop={8}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>

          <ScrollView contentContainerStyle={styles.slide} showsVerticalScrollIndicator={false}>
            <Text style={styles.icon}>{slide.icon}</Text>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
            {slide.bullets ? (
              <View style={styles.bullets}>
                {slide.bullets.map((b) => (
                  <Text key={b} style={styles.bullet}>
                    •  {b}
                  </Text>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>

          <Pressable style={styles.cta} onPress={next}>
            <Text style={styles.ctaText}>{last ? 'Get started' : 'Next'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(2),
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    ...shadow,
  },
  skip: { position: 'absolute', top: spacing(1.5), right: spacing(2), zIndex: 2 },
  skipText: { color: colors.textDim, fontSize: 14, fontWeight: '600', fontFamily },
  slide: { alignItems: 'center', paddingVertical: spacing(2), minHeight: 220 },
  icon: { fontSize: 56, marginBottom: spacing(1.5) },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center', fontFamily, marginBottom: spacing(1) },
  body: { color: colors.textDim, fontSize: 15, lineHeight: 22, textAlign: 'center', fontFamily },
  bullets: { alignSelf: 'stretch', marginTop: spacing(2) },
  bullet: { color: colors.text, fontSize: 14, lineHeight: 24, fontFamily },
  dots: { flexDirection: 'row', justifyContent: 'center', marginVertical: spacing(2) },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border, marginHorizontal: 4 },
  dotActive: { backgroundColor: colors.primary, width: 20 },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily },
});
