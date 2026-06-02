import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { radius, spacing, fontFamily, shadow, listThemes, useTheme, useThemedStyles, Palette } from '../theme';
import { ListHeader } from '../components/ListHeader';
import { Chip, EmptyState } from '../components/ui';
import { todayKey } from '../lib/dates';
import { QUOTES, QUOTE_CATEGORIES, Quote, QuoteCategory } from '../data/quotes';
import { useMotivation } from '../store/useMotivation';

const ACCENT = listThemes.motivation.accent;

type Filter = 'all' | 'favorites' | QuoteCategory;

function copyToClipboard(text: string): void {
  try {
    const g: any = globalThis;
    if (Platform.OS === 'web' && g.navigator?.clipboard?.writeText) {
      g.navigator.clipboard.writeText(text);
    }
  } catch {
    /* best-effort */
  }
}

function categoryMeta(cat: QuoteCategory) {
  return QUOTE_CATEGORIES.find((c) => c.key === cat) ?? QUOTE_CATEGORIES[0];
}

function QuoteCard({
  quote,
  favorite,
  onToggleFavorite,
  onCopy,
  copied,
}: {
  quote: Quote;
  favorite: boolean;
  onToggleFavorite: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const meta = categoryMeta(quote.category);
  return (
    <View style={styles.card}>
      <Text style={styles.cardText}>{quote.text}</Text>
      <View style={styles.cardFooter}>
        <View style={styles.authorWrap}>
          <View style={[styles.catDot, { backgroundColor: meta.accent }]} />
          <Text style={styles.author}>{quote.author}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={onCopy} hitSlop={8} style={styles.actionBtn}>
            <Text style={styles.actionText}>{copied ? '✓ Copied' : '⧉ Copy'}</Text>
          </Pressable>
          <Pressable onPress={onToggleFavorite} hitSlop={8} style={styles.actionBtn}>
            <Text style={[styles.heart, favorite && styles.heartActive]}>{favorite ? '♥' : '♡'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function MotivationScreen({ onBack }: { onBack?: () => void }) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const favorites = useMotivation((s) => s.favorites);
  const toggleFavorite = useMotivation((s) => s.toggleFavorite);

  const [filter, setFilter] = useState<Filter>('all');
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const favSet = useMemo(() => new Set(favorites), [favorites]);

  // Deterministic "quote of the day" so it stays stable across reloads.
  const quoteOfDay = useMemo(() => {
    const n = parseInt(todayKey().replace(/-/g, ''), 10) || 0;
    return QUOTES[n % QUOTES.length];
  }, []);

  const filtered = useMemo(() => {
    let list: Quote[];
    if (filter === 'all') list = QUOTES;
    else if (filter === 'favorites') list = QUOTES.filter((q) => favSet.has(q.id));
    else list = QUOTES.filter((q) => q.category === filter);

    if (shuffleSeed > 0) {
      // Seeded shuffle so order is stable until the user shuffles again.
      const arr = [...list];
      let seed = shuffleSeed;
      const rnd = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
    return list;
  }, [filter, favSet, shuffleSeed]);

  const onCopy = useCallback((q: Quote) => {
    copyToClipboard(`“${q.text}” — ${q.author}`);
    setCopiedId(q.id);
    setTimeout(() => setCopiedId((cur) => (cur === q.id ? null : cur)), 1500);
  }, []);

  const counts = useMemo(() => {
    const byCat: Record<string, number> = {};
    for (const q of QUOTES) byCat[q.category] = (byCat[q.category] ?? 0) + 1;
    return byCat;
  }, []);

  const dayMeta = categoryMeta(quoteOfDay.category);

  return (
    <View style={styles.screen}>
      <ListHeader
        themeKey="motivation"
        icon="🌟"
        title="Motivation"
        subtitle={`${QUOTES.length} quotes · ${favorites.length} favorite${favorites.length === 1 ? '' : 's'}`}
        onBack={onBack}
        right={
          <Pressable onPress={() => setShuffleSeed(Date.now() % 233280 || 1)} hitSlop={8} style={styles.shuffleBtn}>
            <Text style={styles.shuffleText}>🔀 Shuffle</Text>
          </Pressable>
        }
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Quote of the day */}
        <Text style={styles.sectionLabel}>Quote of the day</Text>
        <View style={[styles.qotd, { borderColor: ACCENT + '55' }]}>
          <Text style={styles.qotdMark}>“</Text>
          <Text style={styles.qotdText}>{quoteOfDay.text}</Text>
          <View style={styles.cardFooter}>
            <View style={styles.authorWrap}>
              <View style={[styles.catDot, { backgroundColor: dayMeta.accent }]} />
              <Text style={styles.author}>{quoteOfDay.author}</Text>
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => onCopy(quoteOfDay)} hitSlop={8} style={styles.actionBtn}>
                <Text style={styles.actionText}>{copiedId === quoteOfDay.id ? '✓ Copied' : '⧉ Copy'}</Text>
              </Pressable>
              <Pressable onPress={() => toggleFavorite(quoteOfDay.id)} hitSlop={8} style={styles.actionBtn}>
                <Text style={[styles.heart, favSet.has(quoteOfDay.id) && styles.heartActive]}>
                  {favSet.has(quoteOfDay.id) ? '♥' : '♡'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filters}>
          <Chip label={`All ${QUOTES.length}`} active={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip
            label={`♥ Favorites ${favorites.length}`}
            color={colors.danger}
            active={filter === 'favorites'}
            onPress={() => setFilter('favorites')}
          />
          {QUOTE_CATEGORIES.map((c) => (
            <Chip
              key={c.key}
              label={`${c.icon ? c.icon + ' ' : ''}${c.label} ${counts[c.key] ?? 0}`}
              color={c.accent}
              active={filter === c.key}
              onPress={() => setFilter(c.key)}
            />
          ))}
        </View>

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon="💛"
            title="No favorites yet"
            subtitle="Tap the heart on any quote to save it here."
          />
        ) : (
          filtered.map((q) => (
            <QuoteCard
              key={q.id}
              quote={q}
              favorite={favSet.has(q.id)}
              onToggleFavorite={() => toggleFavorite(q.id)}
              onCopy={() => onCopy(q)}
              copied={copiedId === q.id}
            />
          ))
        )}
        <View style={{ height: spacing(4) }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing(3), paddingTop: spacing(0.5) },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    fontFamily,
    marginBottom: spacing(1),
    marginTop: spacing(1),
  },
  qotd: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing(2.5),
    marginBottom: spacing(2.5),
    ...shadow,
  },
  qotdMark: { color: ACCENT, fontSize: 40, lineHeight: 36, fontWeight: '800', fontFamily, marginBottom: -spacing(1) },
  qotdText: { color: colors.text, fontSize: 21, lineHeight: 30, fontWeight: '600', fontFamily, marginBottom: spacing(2) },
  filters: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing(1.5) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    marginBottom: spacing(1.5),
    ...shadow,
  },
  cardText: { color: colors.text, fontSize: 16, lineHeight: 24, fontFamily, marginBottom: spacing(1.5) },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  authorWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  catDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing(1) },
  author: { color: colors.textDim, fontSize: 13, fontWeight: '600', fontFamily },
  actions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { paddingHorizontal: spacing(1), paddingVertical: spacing(0.5) },
  actionText: { color: colors.textDim, fontSize: 13, fontWeight: '600', fontFamily },
  heart: { color: colors.textFaint, fontSize: 20, lineHeight: 22 },
  heartActive: { color: colors.danger },
  shuffleBtn: { paddingHorizontal: spacing(1), paddingVertical: spacing(0.5) },
  shuffleText: { color: ACCENT, fontSize: 14, fontWeight: '600', fontFamily },
});
