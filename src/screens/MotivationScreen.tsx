import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  radius,
  spacing,
  fontFamily,
  shadow,
  listThemes,
  useTheme,
  useThemedStyles,
  Palette,
} from '../theme';
import { ListHeader } from '../components/ListHeader';
import { EmptyState } from '../components/ui';
import { todayKey } from '../lib/dates';
import { QUOTES, QUOTE_CATEGORIES, Quote, QuoteCategory } from '../data/quotes';
import { useMotivation } from '../store/useMotivation';

const HERO_GRADIENT = ['#8a6a16', '#caa036', '#f5c542'] as const;
// Fixed dark ink that reads well on the golden hero in both light & dark mode.
const HERO_INK = '#241f08';
const HERO_INK_DIM = '#5a4f1c';

// A serif gives the hero a more "literary" feel without pulling in a custom font.
const serifFamily = Platform.select({
  web: 'Georgia, "Times New Roman", serif',
  default: undefined,
}) as string | undefined;

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

// Deterministic "quote of the day" index so it stays stable across reloads.
function todayIndex(): number {
  const n = parseInt(todayKey().replace(/-/g, ''), 10) || 0;
  return n % QUOTES.length;
}

// ──────────────────────────── Hero card ────────────────────────────

function HeroCard({
  quote,
  favorite,
  copied,
  index,
  total,
  isToday,
  onPrev,
  onNext,
  onRandom,
  onBackToToday,
  onCopy,
  onShare,
  onToggleFavorite,
}: {
  quote: Quote;
  favorite: boolean;
  copied: boolean;
  index: number;
  total: number;
  isToday: boolean;
  onPrev: () => void;
  onNext: () => void;
  onRandom: () => void;
  onBackToToday: () => void;
  onCopy: () => void;
  onShare: () => void;
  onToggleFavorite: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const meta = categoryMeta(quote.category);

  // Subtle fade + lift whenever the displayed quote changes.
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [quote.id, fade]);

  const translateY = fade.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });

  return (
    <View style={styles.hero}>
      <LinearGradient
        colors={HERO_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.heroGlyph} pointerEvents="none">“</Text>

      <View style={styles.heroTop}>
        <View style={styles.heroKickerWrap}>
          <View style={styles.heroKickerDot} />
          <Text style={styles.heroKicker}>
            {isToday ? 'QUOTE OF THE DAY' : 'INSPIRATION'}
          </Text>
        </View>
        <View style={styles.heroTopRight}>
          {!isToday ? (
            <Pressable
              onPress={onBackToToday}
              hitSlop={8}
              style={({ hovered }: any) => [styles.heroChip, hovered && styles.heroChipHover]}
            >
              <Text style={styles.heroChipText}>Today</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onRandom}
            hitSlop={8}
            style={({ hovered }: any) => [styles.heroChip, hovered && styles.heroChipHover]}
          >
            <Text style={styles.heroChipText}>↻  Surprise</Text>
          </Pressable>
        </View>
      </View>

      <Animated.View style={{ opacity: fade, transform: [{ translateY }] }}>
        <Text style={styles.heroQuote}>{quote.text}</Text>
        <View style={styles.heroAuthorRow}>
          <View style={styles.heroDash} />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroAuthor} numberOfLines={1}>{quote.author}</Text>
            <Text style={styles.heroCat} numberOfLines={1}>
              {meta.icon ? meta.icon + '  ' : ''}{meta.label}
            </Text>
          </View>
        </View>
      </Animated.View>

      <View style={styles.heroFooter}>
        <View style={styles.heroActions}>
          <Pressable
            onPress={onToggleFavorite}
            hitSlop={8}
            style={({ hovered }: any) => [styles.heroIconBtn, hovered && styles.heroIconBtnHover]}
          >
            <Text style={[styles.heroIcon, favorite && styles.heroHeartActive]}>
              {favorite ? '♥' : '♡'}
            </Text>
          </Pressable>
          <Pressable
            onPress={onCopy}
            hitSlop={8}
            style={({ hovered }: any) => [styles.heroIconBtn, hovered && styles.heroIconBtnHover]}
          >
            <Text style={styles.heroIcon}>{copied ? '✓' : '⧉'}</Text>
          </Pressable>
          <Pressable
            onPress={onShare}
            hitSlop={8}
            style={({ hovered }: any) => [styles.heroIconBtn, hovered && styles.heroIconBtnHover]}
          >
            <Text style={styles.heroIcon}>↗</Text>
          </Pressable>
        </View>
        <View style={styles.heroNav}>
          <Pressable
            onPress={onPrev}
            hitSlop={8}
            style={({ hovered }: any) => [styles.heroNavBtn, hovered && styles.heroNavBtnHover]}
          >
            <Text style={styles.heroNavIcon}>‹</Text>
          </Pressable>
          <Text style={styles.heroCount}>{index + 1} / {total}</Text>
          <Pressable
            onPress={onNext}
            hitSlop={8}
            style={({ hovered }: any) => [styles.heroNavBtn, hovered && styles.heroNavBtnHover]}
          >
            <Text style={styles.heroNavIcon}>›</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ──────────────────────────── Quote card ────────────────────────────

function QuoteCard({
  quote,
  favorite,
  copied,
  onToggleFavorite,
  onCopy,
}: {
  quote: Quote;
  favorite: boolean;
  copied: boolean;
  onToggleFavorite: () => void;
  onCopy: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const meta = categoryMeta(quote.category);
  return (
    <Pressable
      onPress={onCopy}
      style={({ hovered, pressed }: any) => [
        styles.card,
        hovered && styles.cardHover,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.cardAccent, { backgroundColor: meta.accent }]} />
      <Text style={styles.cardText}>{quote.text}</Text>
      <View style={styles.cardFooter}>
        <View style={styles.cardMeta}>
          <Text style={styles.cardAuthor} numberOfLines={1}>— {quote.author}</Text>
          <Text style={[styles.cardCat, { color: meta.accent }]} numberOfLines={1}>
            {meta.icon ? meta.icon + '  ' : ''}{meta.label}
          </Text>
        </View>
        <View style={styles.cardActions}>
          <Pressable
            onPress={onCopy}
            hitSlop={6}
            style={({ hovered }: any) => [styles.iconBtn, hovered && styles.iconBtnHover]}
          >
            <Text style={styles.actionText}>{copied ? '✓' : '⧉'}</Text>
          </Pressable>
          <Pressable
            onPress={onToggleFavorite}
            hitSlop={6}
            style={({ hovered }: any) => [styles.iconBtn, hovered && styles.iconBtnHover]}
          >
            <Text style={[styles.heart, favorite && styles.heartActive]}>
              {favorite ? '♥' : '♡'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

// ──────────────────────────── Screen ────────────────────────────

export function MotivationScreen({ onBack }: { onBack?: () => void }) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const favorites = useMotivation((s) => s.favorites);
  const toggleFavorite = useMotivation((s) => s.toggleFavorite);

  const [filter, setFilter] = useState<Filter>('all');
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState<number>(() => todayIndex());

  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const todayIdx = useMemo(() => todayIndex(), []);
  const featured = QUOTES[heroIndex] ?? QUOTES[0];
  const isToday = heroIndex === todayIdx;

  const goPrev = useCallback(() => {
    setHeroIndex((i) => (i - 1 + QUOTES.length) % QUOTES.length);
  }, []);
  const goNext = useCallback(() => {
    setHeroIndex((i) => (i + 1) % QUOTES.length);
  }, []);
  const random = useCallback(() => {
    setHeroIndex((cur) => {
      let next = cur;
      for (let i = 0; i < 8 && next === cur; i++) {
        next = Math.floor(Math.random() * QUOTES.length);
      }
      return next;
    });
  }, []);
  const backToToday = useCallback(() => setHeroIndex(todayIdx), [todayIdx]);

  // Web-only keyboard navigation: ← / → step through the hero. Skips while
  // focus is in an editable field so it doesn't fight text input.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const w: any = globalThis;
    if (!w?.addEventListener) return;
    const handler = (e: any) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const t = e.target as any;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    };
    w.addEventListener('keydown', handler);
    return () => w.removeEventListener('keydown', handler);
  }, [goPrev, goNext]);

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

  const onShare = useCallback((q: Quote) => {
    const shared = shareQuote(`“${q.text}” — ${q.author}`);
    if (!shared) {
      setCopiedId(q.id);
      setTimeout(() => setCopiedId((cur) => (cur === q.id ? null : cur)), 1500);
    }
  }, []);

  const counts = useMemo(() => {
    const byCat: Record<string, number> = {};
    for (const q of QUOTES) byCat[q.category] = (byCat[q.category] ?? 0) + 1;
    return byCat;
  }, []);

  const renderChip = (
    key: string,
    label: string,
    count: number | null,
    accent: string | null,
    active: boolean,
    onPress: () => void,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={({ hovered }: any) => [
        styles.chip,
        active && { backgroundColor: accent ?? colors.primary, borderColor: accent ?? colors.primary },
        !active && hovered && styles.chipHover,
      ]}
    >
      <Text style={[styles.chipText, active && { color: colors.onAccent, fontWeight: '700' }]}>
        {label}
      </Text>
      {count != null ? (
        <Text style={[styles.chipCount, active && styles.chipCountActive]}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );

  const sectionLabel =
    filter === 'all' ? 'All quotes'
    : filter === 'favorites' ? 'Favorites'
    : categoryMeta(filter).label;

  return (
    <View style={styles.screen}>
      <ListHeader
        themeKey="motivation"
        icon="🌟"
        title="Motivation"
        subtitle={`${QUOTES.length} quotes · ${favorites.length} favorite${favorites.length === 1 ? '' : 's'}`}
        onBack={onBack}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <HeroCard
          quote={featured}
          favorite={favSet.has(featured.id)}
          copied={copiedId === featured.id}
          index={heroIndex}
          total={QUOTES.length}
          isToday={isToday}
          onPrev={goPrev}
          onNext={goNext}
          onRandom={random}
          onBackToToday={backToToday}
          onCopy={() => onCopy(featured)}
          onShare={() => onShare(featured)}
          onToggleFavorite={() => toggleFavorite(featured.id)}
        />

        <View style={styles.libHeader}>
          <View style={styles.libTitleWrap}>
            <Text style={styles.libTitle}>{sectionLabel}</Text>
            <Text style={styles.libCount}>{filtered.length}</Text>
          </View>
          <Pressable
            onPress={() => setShuffleSeed(shuffleSeed === 0 ? (Date.now() % 233280 || 1) : 0)}
            hitSlop={6}
            style={({ hovered }: any) => [styles.shuffleBtn, hovered && styles.shuffleBtnHover]}
          >
            <Text style={styles.shuffleText}>
              {shuffleSeed > 0 ? '✓ Shuffled' : '🔀 Shuffle'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filters}
          contentContainerStyle={styles.filtersInner}
        >
          {renderChip('all', 'All', QUOTES.length, null, filter === 'all', () => setFilter('all'))}
          {renderChip(
            'favorites',
            '♥ Favorites',
            favorites.length,
            colors.danger,
            filter === 'favorites',
            () => setFilter('favorites'),
          )}
          {QUOTE_CATEGORIES.map((c) =>
            renderChip(
              c.key,
              `${c.icon ? c.icon + ' ' : ''}${c.label}`,
              counts[c.key] ?? 0,
              c.accent,
              filter === c.key,
              () => setFilter(c.key),
            ),
          )}
        </ScrollView>

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
              copied={copiedId === q.id}
              onToggleFavorite={() => toggleFavorite(q.id)}
              onCopy={() => onCopy(q)}
            />
          ))
        )}
        <View style={{ height: spacing(6) }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing(3), paddingTop: spacing(0.5) },

  // ─── Hero ───
  hero: {
    borderRadius: 20,
    paddingHorizontal: spacing(3),
    paddingTop: spacing(2.5),
    paddingBottom: spacing(2.25),
    marginBottom: spacing(3),
    overflow: 'hidden',
    ...(Platform.select({
      web: { boxShadow: '0 10px 30px rgba(138,106,22,0.28), 0 2px 6px rgba(0,0,0,0.10)' } as any,
      default: shadow,
    }) as any),
  },
  heroGlyph: {
    position: 'absolute',
    top: -34,
    left: spacing(1.25),
    fontSize: 200,
    lineHeight: 200,
    color: '#ffffff26',
    fontFamily: serifFamily,
    fontWeight: '400',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(2.25),
  },
  heroKickerWrap: { flexDirection: 'row', alignItems: 'center' },
  heroKickerDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: HERO_INK,
    marginRight: spacing(1),
    opacity: 0.85,
  },
  heroKicker: { color: HERO_INK, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, fontFamily },
  heroTopRight: { flexDirection: 'row', alignItems: 'center' },
  heroChip: {
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.625),
    borderRadius: radius.pill,
    backgroundColor: '#ffffff3a',
    marginLeft: spacing(0.75),
    ...(Platform.select({ web: { transition: 'background-color 140ms ease' } as any }) as any),
  },
  heroChipHover: { backgroundColor: '#ffffff62' },
  heroChipText: { color: HERO_INK, fontSize: 12, fontWeight: '700', fontFamily },

  heroQuote: {
    color: HERO_INK,
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '400',
    fontFamily: serifFamily,
    fontStyle: 'italic',
    marginBottom: spacing(2),
  },
  heroAuthorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing(2.5) },
  heroDash: { width: 26, height: 2, backgroundColor: HERO_INK, marginRight: spacing(1.25), opacity: 0.65 },
  heroAuthor: { color: HERO_INK, fontSize: 15, fontWeight: '700', fontFamily, letterSpacing: 0.2 },
  heroCat: { color: HERO_INK_DIM, fontSize: 12, fontWeight: '600', fontFamily, marginTop: 2 },

  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroActions: { flexDirection: 'row', alignItems: 'center' },
  heroIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#ffffff35',
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing(0.75),
    ...(Platform.select({
      web: { transition: 'background-color 140ms ease, transform 140ms ease' } as any,
    }) as any),
  },
  heroIconBtnHover: {
    backgroundColor: '#ffffff62',
    transform: [{ translateY: -1 }],
  },
  heroIcon: { color: HERO_INK, fontSize: 17, lineHeight: 20, fontWeight: '700' },
  heroHeartActive: { color: '#c01933' },

  heroNav: { flexDirection: 'row', alignItems: 'center' },
  heroNavBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    ...(Platform.select({ web: { transition: 'background-color 140ms ease' } as any }) as any),
  },
  heroNavBtnHover: { backgroundColor: '#ffffff3a' },
  heroNavIcon: { color: HERO_INK, fontSize: 26, lineHeight: 28, fontWeight: '300' },
  heroCount: {
    color: HERO_INK,
    fontSize: 12,
    fontWeight: '700',
    fontFamily,
    marginHorizontal: spacing(0.5),
    minWidth: 56,
    textAlign: 'center',
    letterSpacing: 0.4,
  },

  // ─── Library section ───
  libHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(1.25),
    paddingHorizontal: spacing(0.25),
  },
  libTitleWrap: { flexDirection: 'row', alignItems: 'baseline' },
  libTitle: { color: colors.text, fontSize: 15, fontWeight: '700', fontFamily, letterSpacing: 0.3 },
  libCount: { color: colors.textFaint, fontSize: 13, fontWeight: '600', fontFamily, marginLeft: spacing(0.75) },
  shuffleBtn: {
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.625),
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    ...(Platform.select({ web: { transition: 'background-color 140ms ease' } as any }) as any),
  },
  shuffleBtnHover: { backgroundColor: colors.border },
  shuffleText: { color: colors.textDim, fontSize: 12, fontWeight: '700', fontFamily },

  // ─── Filters ───
  filters: { marginBottom: spacing(1.75), marginHorizontal: -spacing(3) },
  filtersInner: { paddingHorizontal: spacing(3), paddingRight: spacing(2) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(0.75),
    paddingHorizontal: spacing(1.5),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    marginRight: spacing(0.875),
    ...(Platform.select({ web: { transition: 'background-color 140ms ease, border-color 140ms ease' } as any }) as any),
  },
  chipHover: { backgroundColor: colors.surfaceAlt },
  chipText: { color: colors.textDim, fontSize: 13, fontWeight: '600', fontFamily },
  chipCount: { color: colors.textFaint, fontSize: 11, fontWeight: '700', fontFamily, marginLeft: spacing(0.625) },
  chipCountActive: { color: colors.onAccent, opacity: 0.85 },

  // ─── Quote cards ───
  card: {
    position: 'relative',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(2),
    paddingLeft: spacing(2.5),
    paddingRight: spacing(2),
    marginBottom: spacing(1.25),
    overflow: 'hidden',
    ...(Platform.select({
      web: {
        transition: 'background-color 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease',
      } as any,
    }) as any),
  },
  cardHover: {
    backgroundColor: colors.surfaceAlt,
    transform: [{ translateY: -1 }],
    ...(Platform.select({
      web: { boxShadow: '0 4px 14px rgba(0,0,0,0.10)' } as any,
    }) as any),
  },
  cardPressed: { opacity: 0.92 },
  cardAccent: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 3,
  },
  cardText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 25,
    fontFamily: serifFamily,
    fontStyle: 'italic',
    fontWeight: '400',
    marginBottom: spacing(1.5),
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMeta: { flex: 1, marginRight: spacing(1) },
  cardAuthor: { color: colors.text, fontSize: 13, fontWeight: '600', fontFamily },
  cardCat: { fontSize: 11, fontWeight: '700', fontFamily, marginTop: 2, letterSpacing: 0.4 },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: spacing(0.5),
    ...(Platform.select({ web: { transition: 'background-color 140ms ease' } as any }) as any),
  },
  iconBtnHover: { backgroundColor: colors.border },
  actionText: { color: colors.textDim, fontSize: 14, fontWeight: '700', fontFamily },
  heart: { color: colors.textFaint, fontSize: 17, lineHeight: 19 },
  heartActive: { color: colors.danger },
});
