import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { radius, spacing, fontFamily, shadow, listThemes, useTheme, useThemedStyles, Palette } from '../theme';
import { ListHeader } from '../components/ListHeader';
import { EmptyState } from '../components/ui';
import { todayKey } from '../lib/dates';
import { QUOTES, QUOTE_CATEGORIES, Quote, QuoteCategory } from '../data/quotes';
import { useMotivation } from '../store/useMotivation';

const ACCENT = listThemes.motivation.accent;
// Fixed dark ink that reads well on the golden hero in both light & dark mode.
const HERO_INK = '#241f08';
const HERO_INK_DIM = '#5a4f1c';

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

function shareQuote(text: string): boolean {
  try {
    const g: any = globalThis;
    if (Platform.OS === 'web' && g.navigator?.share) {
      g.navigator.share({ text }).catch(() => {});
      return true;
    }
  } catch {
    /* best-effort */
  }
  copyToClipboard(text);
  return false;
}

function categoryMeta(cat: QuoteCategory) {
  return QUOTE_CATEGORIES.find((c) => c.key === cat) ?? QUOTE_CATEGORIES[0];
}

function initial(author: string): string {
  const a = author.trim();
  return a ? a[0].toUpperCase() : '“';
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
      <View style={[styles.cardStripe, { backgroundColor: meta.accent }]} />
      <Text style={[styles.cardMark, { color: meta.accent + '33' }]}>”</Text>
      <Text style={styles.cardText}>{quote.text}</Text>
      <View style={styles.cardFooter}>
        <View style={styles.authorWrap}>
          <View style={[styles.avatar, { backgroundColor: meta.accent }]}>
            <Text style={styles.avatarText}>{initial(quote.author)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.author} numberOfLines={1}>
              {quote.author}
            </Text>
            <Text style={[styles.catTag, { color: meta.accent }]} numberOfLines={1}>
              {meta.icon ? meta.icon + ' ' : ''}
              {meta.label}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={onCopy} hitSlop={8} style={styles.iconBtn}>
            <Text style={styles.actionText}>{copied ? '✓' : '⧉'}</Text>
          </Pressable>
          <Pressable onPress={onToggleFavorite} hitSlop={8} style={styles.iconBtn}>
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
  const [heroId, setHeroId] = useState<string | null>(null);

  const favSet = useMemo(() => new Set(favorites), [favorites]);

  // Deterministic "quote of the day" so it stays stable across reloads.
  const quoteOfDay = useMemo(() => {
    const n = parseInt(todayKey().replace(/-/g, ''), 10) || 0;
    return QUOTES[n % QUOTES.length];
  }, []);

  const featured = useMemo(
    () => (heroId ? QUOTES.find((q) => q.id === heroId) ?? quoteOfDay : quoteOfDay),
    [heroId, quoteOfDay],
  );

  const surprise = useCallback(() => {
    let next = featured;
    for (let i = 0; i < 5 && next.id === featured.id; i++) {
      next = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    }
    setHeroId(next.id);
  }, [featured]);

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

  const onShare = useCallback(
    (q: Quote) => {
      const shared = shareQuote(`“${q.text}” — ${q.author}`);
      if (!shared) {
        setCopiedId(q.id);
        setTimeout(() => setCopiedId((cur) => (cur === q.id ? null : cur)), 1500);
      }
    },
    [],
  );

  const counts = useMemo(() => {
    const byCat: Record<string, number> = {};
    for (const q of QUOTES) byCat[q.category] = (byCat[q.category] ?? 0) + 1;
    return byCat;
  }, []);

  const heroMeta = categoryMeta(featured.category);
  const heroFav = favSet.has(featured.id);

  const renderChip = (
    key: string,
    label: string,
    dot: string | null,
    active: boolean,
    onPress: () => void,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={[styles.chip, active && { borderColor: dot ?? colors.primary, backgroundColor: (dot ?? colors.primary) + '1f' }]}
    >
      {dot ? <View style={[styles.chipDot, { backgroundColor: dot }]} /> : null}
      <Text style={[styles.chipText, active && { color: dot ?? colors.primary, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );

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

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero — quote of the day */}
        <View style={styles.hero}>
          <View style={styles.heroBlob1} />
          <View style={styles.heroBlob2} />
          <Text style={styles.heroWatermark}>”</Text>

          <View style={styles.heroTop}>
            <Text style={styles.heroKicker}>✦ {heroId ? 'INSPIRATION' : 'QUOTE OF THE DAY'}</Text>
            <Pressable onPress={surprise} hitSlop={10} style={styles.heroRefresh}>
              <Text style={styles.heroRefreshText}>↻ Surprise me</Text>
            </Pressable>
          </View>

          <Text style={styles.heroQuote}>{featured.text}</Text>

          <View style={styles.heroFooter}>
            <View style={styles.heroAuthorWrap}>
              <View style={styles.heroAvatar}>
                <Text style={styles.heroAvatarText}>{initial(featured.author)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroAuthor} numberOfLines={1}>
                  {featured.author}
                </Text>
                <Text style={styles.heroCat} numberOfLines={1}>
                  {heroMeta.icon ? heroMeta.icon + ' ' : ''}
                  {heroMeta.label}
                </Text>
              </View>
            </View>
            <View style={styles.heroActions}>
              <Pressable onPress={() => toggleFavorite(featured.id)} hitSlop={8} style={styles.heroIconBtn}>
                <Text style={[styles.heroHeart, heroFav && styles.heroHeartActive]}>{heroFav ? '♥' : '♡'}</Text>
              </Pressable>
              <Pressable onPress={() => onShare(featured)} hitSlop={8} style={styles.heroIconBtn}>
                <Text style={styles.heroShare}>↗</Text>
              </Pressable>
              <Pressable onPress={() => onCopy(featured)} hitSlop={6} style={styles.heroCopyBtn}>
                <Text style={styles.heroCopyText}>{copiedId === featured.id ? '✓ Copied' : 'Copy'}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filters}
          contentContainerStyle={styles.filtersInner}
        >
          {renderChip('all', `All ${QUOTES.length}`, null, filter === 'all', () => setFilter('all'))}
          {renderChip(
            'favorites',
            `♥ Favorites ${favorites.length}`,
            colors.danger,
            filter === 'favorites',
            () => setFilter('favorites'),
          )}
          {QUOTE_CATEGORIES.map((c) =>
            renderChip(
              c.key,
              `${c.icon ? c.icon + ' ' : ''}${c.label} ${counts[c.key] ?? 0}`,
              c.accent,
              filter === c.key,
              () => setFilter(c.key),
            ),
          )}
        </ScrollView>

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
  content: { paddingHorizontal: spacing(3), paddingTop: spacing(1) },

  // Hero
  hero: {
    backgroundColor: ACCENT,
    borderRadius: radius.lg + 6,
    padding: spacing(2.75),
    marginBottom: spacing(2.5),
    overflow: 'hidden',
    ...shadow,
  },
  heroBlob1: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#ffffff22',
  },
  heroBlob2: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#00000012',
  },
  heroWatermark: {
    position: 'absolute',
    top: -14,
    right: 14,
    fontSize: 130,
    lineHeight: 130,
    color: '#ffffff2e',
    fontWeight: '900',
    fontFamily,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1.5) },
  heroKicker: { color: HERO_INK, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, fontFamily },
  heroRefresh: {
    backgroundColor: '#ffffff40',
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.5),
    borderRadius: radius.pill,
  },
  heroRefreshText: { color: HERO_INK, fontSize: 12, fontWeight: '700', fontFamily },
  heroQuote: {
    color: HERO_INK,
    fontSize: 23,
    lineHeight: 32,
    fontWeight: '800',
    fontFamily,
    marginBottom: spacing(2.25),
  },
  heroFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroAuthorWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing(1) },
  heroAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff55',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(1.25),
  },
  heroAvatarText: { color: HERO_INK, fontSize: 18, fontWeight: '800', fontFamily },
  heroAuthor: { color: HERO_INK, fontSize: 15, fontWeight: '800', fontFamily },
  heroCat: { color: HERO_INK_DIM, fontSize: 12, fontWeight: '600', fontFamily, marginTop: 1 },
  heroActions: { flexDirection: 'row', alignItems: 'center' },
  heroIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff3a',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing(0.75),
  },
  heroHeart: { color: HERO_INK, fontSize: 18, lineHeight: 20 },
  heroHeartActive: { color: '#c01933' },
  heroShare: { color: HERO_INK, fontSize: 16, fontWeight: '800', lineHeight: 18 },
  heroCopyBtn: {
    backgroundColor: HERO_INK,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.85),
    borderRadius: radius.pill,
    marginLeft: spacing(0.75),
  },
  heroCopyText: { color: ACCENT, fontSize: 13, fontWeight: '800', fontFamily },

  // Filters
  filters: { marginBottom: spacing(2), marginHorizontal: -spacing(3) },
  filtersInner: { paddingHorizontal: spacing(3), paddingRight: spacing(2) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(0.85),
    paddingHorizontal: spacing(1.5),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing(1),
  },
  chipDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  chipText: { color: colors.textDim, fontSize: 13, fontWeight: '600', fontFamily },

  // Quote cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(2),
    paddingLeft: spacing(2.25),
    paddingRight: spacing(2),
    marginBottom: spacing(1.5),
    overflow: 'hidden',
    ...shadow,
  },
  cardStripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardMark: {
    position: 'absolute',
    top: -10,
    right: 10,
    fontSize: 64,
    lineHeight: 64,
    fontWeight: '900',
    fontFamily,
  },
  cardText: { color: colors.text, fontSize: 16, lineHeight: 24, fontFamily, marginBottom: spacing(1.75) },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  authorWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing(1) },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(1.25),
  },
  avatarText: { color: '#ffffff', fontSize: 15, fontWeight: '800', fontFamily },
  author: { color: colors.text, fontSize: 14, fontWeight: '700', fontFamily },
  catTag: { fontSize: 12, fontWeight: '600', fontFamily, marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing(0.75),
  },
  actionText: { color: colors.textDim, fontSize: 15, fontWeight: '700', fontFamily },
  heart: { color: colors.textFaint, fontSize: 18, lineHeight: 20 },
  heartActive: { color: colors.danger },

  shuffleBtn: { paddingHorizontal: spacing(1), paddingVertical: spacing(0.5) },
  shuffleText: { color: ACCENT, fontSize: 14, fontWeight: '600', fontFamily },
});
