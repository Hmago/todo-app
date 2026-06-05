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
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  radius,
  spacing,
  fontFamily,
  useTheme,
  useThemedStyles,
  Palette,
} from '../theme';
import { ListHeader } from '../components/ListHeader';
import { EmptyState } from '../components/ui';
import { Tooltip } from '../components/Tooltip';
import { todayKey } from '../lib/dates';
import { QUOTES, QUOTE_CATEGORIES, Quote, QuoteCategory } from '../data/quotes';
import { useMotivation } from '../store/useMotivation';

// Modern indigo→violet "evening reflection" palette — calm, deep, and modern.
// Replaces the previous bronze "leather-bound book" look that felt dated.
const HERO_GRADIENT = ['#1e1b4b', '#312e81', '#5b21b6'] as const;
const HERO_INK = '#f8fafc';
const HERO_INK_DIM = '#c7d2fe';
const HERO_HEART_ACTIVE = '#fb7185';

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

// ──────────────────────────── Hero ────────────────────────────

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

  // Soft cross-fade whenever the displayed quote changes.
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [quote.id, fade]);
  const translateY = fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <View style={styles.hero}>
      <LinearGradient
        colors={HERO_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft glow accent at top-right for depth without the old "“" glyph. */}
      <View style={styles.heroGlow} pointerEvents="none" />

      <View style={styles.heroTop}>
        <View style={styles.heroTagWrap}>
          <View style={[styles.heroTagDot, { backgroundColor: meta.accent }]} />
          <Text style={styles.heroTag}>{meta.label}</Text>
        </View>
        <Text style={styles.heroCount}>{index + 1} / {total}</Text>
      </View>

      <Animated.View style={[styles.heroBody, { opacity: fade, transform: [{ translateY }] }]}>
        <Text style={styles.heroQuote}>{quote.text}</Text>
        <Text style={styles.heroAuthor} numberOfLines={1}>{quote.author}</Text>
      </Animated.View>

      <View style={styles.heroFooter}>
        <View style={styles.heroActions}>
          <Tooltip label={favorite ? 'Remove from favorites' : 'Save to favorites'}>
            <Pressable
              onPress={onToggleFavorite}
              hitSlop={8}
              accessibilityLabel={favorite ? 'Remove from favorites' : 'Save to favorites'}
              style={({ hovered }: any) => [styles.heroIconBtn, hovered && styles.heroIconBtnHover]}
            >
              <Text style={[styles.heroIcon, favorite && { color: HERO_HEART_ACTIVE }]}>
                {favorite ? '♥' : '♡'}
              </Text>
            </Pressable>
          </Tooltip>
          <Tooltip label={copied ? 'Copied!' : 'Copy quote'}>
            <Pressable
              onPress={onCopy}
              hitSlop={8}
              accessibilityLabel="Copy quote"
              style={({ hovered }: any) => [styles.heroIconBtn, hovered && styles.heroIconBtnHover]}
            >
              <Text style={styles.heroIcon}>{copied ? '✓' : '⧉'}</Text>
            </Pressable>
          </Tooltip>
          <Tooltip label="Share">
            <Pressable
              onPress={onShare}
              hitSlop={8}
              accessibilityLabel="Share quote"
              style={({ hovered }: any) => [styles.heroIconBtn, hovered && styles.heroIconBtnHover]}
            >
              <Text style={styles.heroIcon}>↗</Text>
            </Pressable>
          </Tooltip>
          <Tooltip label="Random quote">
            <Pressable
              onPress={onRandom}
              hitSlop={8}
              accessibilityLabel="Random quote"
              style={({ hovered }: any) => [styles.heroIconBtn, hovered && styles.heroIconBtnHover]}
            >
              <Text style={styles.heroIcon}>⟲</Text>
            </Pressable>
          </Tooltip>
        </View>
        <View style={styles.heroNav}>
          {!isToday ? (
            <Tooltip label="Back to today's quote">
              <Pressable
                onPress={onBackToToday}
                hitSlop={8}
                accessibilityLabel="Back to today's quote"
                style={({ hovered }: any) => [styles.heroTodayBtn, hovered && styles.heroTodayBtnHover]}
              >
                <Text style={styles.heroTodayText}>Today</Text>
              </Pressable>
            </Tooltip>
          ) : (
            <View style={styles.heroTodayPlaceholder}>
              <Text style={styles.heroTodayPlaceholderText}>Today</Text>
            </View>
          )}
          <Tooltip label="Previous">
            <Pressable
              onPress={onPrev}
              hitSlop={8}
              accessibilityLabel="Previous quote"
              style={({ hovered }: any) => [styles.heroNavBtn, hovered && styles.heroNavBtnHover]}
            >
              <Text style={styles.heroNavIcon}>‹</Text>
            </Pressable>
          </Tooltip>
          <Tooltip label="Next">
            <Pressable
              onPress={onNext}
              hitSlop={8}
              accessibilityLabel="Next quote"
              style={({ hovered }: any) => [styles.heroNavBtn, hovered && styles.heroNavBtnHover]}
            >
              <Text style={styles.heroNavIcon}>›</Text>
            </Pressable>
          </Tooltip>
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
      <View style={styles.cardTopRow}>
        <View style={styles.cardTag}>
          <View style={[styles.cardTagDot, { backgroundColor: meta.accent }]} />
          <Text style={styles.cardTagText}>{meta.label}</Text>
        </View>
        <Tooltip label={favorite ? 'Remove from favorites' : 'Save to favorites'}>
          <Pressable
            onPress={onToggleFavorite}
            hitSlop={6}
            accessibilityLabel={favorite ? 'Remove from favorites' : 'Save to favorites'}
            style={({ hovered }: any) => [styles.cardHeart, hovered && styles.cardHeartHover]}
          >
            <Text style={[styles.heart, favorite && styles.heartActive]}>
              {favorite ? '♥' : '♡'}
            </Text>
          </Pressable>
        </Tooltip>
      </View>
      <Text style={styles.cardText}>{quote.text}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardAuthor} numberOfLines={1}>{quote.author}</Text>
        {copied ? <Text style={styles.copiedFlag}>✓ Copied</Text> : null}
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
  const [search, setSearch] = useState('');
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
  // focus is in an editable field so it doesn't fight text input (including
  // the search box added in this redesign).
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

    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (q) => q.text.toLowerCase().includes(term) || q.author.toLowerCase().includes(term),
      );
    }

    if (shuffleSeed > 0) {
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
  }, [filter, favSet, shuffleSeed, search]);

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

  const renderChip = (
    key: string,
    label: string,
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
    </Pressable>
  );

  const sectionLabel =
    filter === 'all' ? 'All quotes'
    : filter === 'favorites' ? 'Favorites'
    : categoryMeta(filter).label;

  // Empty-state messaging differs by reason: search miss, favorites empty, or
  // category empty (rare). Helps users understand why nothing is shown.
  let emptyEl: React.ReactNode = null;
  if (filtered.length === 0) {
    if (search.trim()) {
      emptyEl = (
        <EmptyState
          icon="🔍"
          title="No matches"
          subtitle={`Nothing matches “${search.trim()}” in ${sectionLabel.toLowerCase()}.`}
        />
      );
    } else if (filter === 'favorites') {
      emptyEl = (
        <EmptyState
          icon="💛"
          title="No favorites yet"
          subtitle="Tap the heart on any quote to save it here."
        />
      );
    } else {
      emptyEl = (
        <EmptyState
          icon="✨"
          title="No quotes in this category yet"
        />
      );
    }
  }

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

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by text or author"
            placeholderTextColor={colors.textFaint}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <Pressable
              onPress={() => setSearch('')}
              hitSlop={6}
              accessibilityLabel="Clear search"
              style={({ hovered }: any) => [styles.searchClear, hovered && styles.searchClearHover]}
            >
              <Text style={styles.searchClearText}>×</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filters}
          contentContainerStyle={styles.filtersInner}
        >
          {renderChip('all', 'All', null, filter === 'all', () => setFilter('all'))}
          {renderChip(
            'favorites',
            `♥ Favorites${favorites.length > 0 ? ` · ${favorites.length}` : ''}`,
            colors.danger,
            filter === 'favorites',
            () => setFilter('favorites'),
          )}
          {QUOTE_CATEGORIES.map((c) =>
            renderChip(c.key, c.label, c.accent, filter === c.key, () => setFilter(c.key)),
          )}
        </ScrollView>

        <View style={styles.libHeader}>
          <View style={styles.libTitleWrap}>
            <Text style={styles.libTitle}>{sectionLabel}</Text>
            <Text style={styles.libCount}>{filtered.length}</Text>
          </View>
          <Tooltip label={shuffleSeed > 0 ? 'Restore default order' : 'Shuffle quotes'}>
            <Pressable
              onPress={() => setShuffleSeed(shuffleSeed === 0 ? (Date.now() % 233280 || 1) : 0)}
              hitSlop={6}
              accessibilityLabel="Shuffle quotes"
              style={({ hovered }: any) => [styles.shuffleBtn, hovered && styles.shuffleBtnHover]}
            >
              <Text style={styles.shuffleText}>
                {shuffleSeed > 0 ? '✓ Shuffled' : '🔀 Shuffle'}
              </Text>
            </Pressable>
          </Tooltip>
        </View>

        {emptyEl ? (
          emptyEl
        ) : (
          <View style={styles.grid}>
            {filtered.map((q) => (
              <QuoteCard
                key={q.id}
                quote={q}
                favorite={favSet.has(q.id)}
                copied={copiedId === q.id}
                onToggleFavorite={() => toggleFavorite(q.id)}
                onCopy={() => onCopy(q)}
              />
            ))}
          </View>
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
    borderRadius: 24,
    paddingHorizontal: spacing(3),
    paddingTop: spacing(2.25),
    paddingBottom: spacing(2),
    marginBottom: spacing(2.5),
    overflow: 'hidden',
    ...(Platform.select({
      web: { boxShadow: '0 18px 38px rgba(30,27,75,0.45), 0 4px 12px rgba(0,0,0,0.18)' } as any,
      default: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
    }) as any),
  },
  heroGlow: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#ffffff14',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(2),
  },
  heroTagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff1f',
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.375),
    borderRadius: radius.pill,
  },
  heroTagDot: { width: 6, height: 6, borderRadius: 3, marginRight: spacing(0.625) },
  heroTag: { color: HERO_INK, fontSize: 11, fontWeight: '700', fontFamily, letterSpacing: 0.6 },
  heroCount: {
    color: HERO_INK_DIM,
    fontSize: 12,
    fontWeight: '600',
    fontFamily,
    letterSpacing: 0.4,
  },

  heroBody: { marginBottom: spacing(2.25) },
  heroQuote: {
    color: HERO_INK,
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '500',
    fontFamily,
    marginBottom: spacing(1.5),
  },
  heroAuthor: { color: HERO_INK_DIM, fontSize: 13, fontWeight: '600', fontFamily, letterSpacing: 0.3 },

  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing(1),
  },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.5) },
  heroIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#ffffff1f',
    alignItems: 'center', justifyContent: 'center',
    ...(Platform.select({
      web: { transition: 'background-color 140ms ease, transform 140ms ease' } as any,
    }) as any),
  },
  heroIconBtnHover: {
    backgroundColor: '#ffffff36',
    transform: [{ translateY: -1 }],
  },
  heroIcon: { color: HERO_INK, fontSize: 17, lineHeight: 20, fontWeight: '700' },

  heroNav: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.5) },
  heroTodayBtn: {
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.5),
    borderRadius: radius.pill,
    backgroundColor: '#ffffff26',
    ...(Platform.select({ web: { transition: 'background-color 140ms ease' } as any }) as any),
  },
  heroTodayBtnHover: { backgroundColor: '#ffffff42' },
  heroTodayText: { color: HERO_INK, fontSize: 12, fontWeight: '700', fontFamily },
  heroTodayPlaceholder: {
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.5),
    opacity: 0,
  },
  heroTodayPlaceholderText: { color: HERO_INK, fontSize: 12, fontWeight: '700', fontFamily },
  heroNavBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ffffff14',
    ...(Platform.select({ web: { transition: 'background-color 140ms ease' } as any }) as any),
  },
  heroNavBtnHover: { backgroundColor: '#ffffff36' },
  heroNavIcon: { color: HERO_INK, fontSize: 22, lineHeight: 24, fontWeight: '400' },

  // ─── Search ───
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(1.5),
    height: 40,
    marginBottom: spacing(1.5),
    ...(Platform.select({ web: { transition: 'border-color 140ms ease' } as any }) as any),
  },
  searchIcon: { color: colors.textFaint, fontSize: 14, marginRight: spacing(1) },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontFamily,
    fontWeight: '500',
    padding: 0,
    ...(Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any }) as any),
  },
  searchClear: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  searchClearHover: { backgroundColor: colors.border },
  searchClearText: { color: colors.textDim, fontSize: 16, lineHeight: 16, fontWeight: '700' },

  // ─── Library header ───
  libHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(1.5),
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
  filters: { marginBottom: spacing(1.5), marginHorizontal: -spacing(3) },
  filtersInner: { paddingHorizontal: spacing(3), paddingRight: spacing(2), gap: spacing(0.875) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(0.75),
    paddingHorizontal: spacing(1.5),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    ...(Platform.select({ web: { transition: 'background-color 140ms ease, border-color 140ms ease' } as any }) as any),
  },
  chipHover: { backgroundColor: colors.surfaceAlt },
  chipText: { color: colors.textDim, fontSize: 13, fontWeight: '600', fontFamily },

  // ─── Responsive 2-col card grid ───
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(1.5),
  },

  // ─── Quote cards ───
  card: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 320,
    minWidth: 260,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    ...(Platform.select({
      web: {
        transition: 'background-color 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease',
      } as any,
    }) as any),
  },
  cardHover: {
    backgroundColor: colors.surfaceAlt,
    transform: [{ translateY: -2 }],
    ...(Platform.select({
      web: { boxShadow: '0 8px 20px rgba(0,0,0,0.16)' } as any,
    }) as any),
  },
  cardPressed: { opacity: 0.92 },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(1.25),
  },
  cardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(0.875),
    paddingVertical: spacing(0.25),
    borderRadius: radius.pill,
  },
  cardTagDot: { width: 6, height: 6, borderRadius: 3, marginRight: spacing(0.5) },
  cardTagText: { color: colors.textDim, fontSize: 11, fontWeight: '700', fontFamily, letterSpacing: 0.3 },
  cardHeart: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    ...(Platform.select({ web: { transition: 'background-color 140ms ease' } as any }) as any),
  },
  cardHeartHover: { backgroundColor: colors.surfaceAlt },
  cardText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
    fontFamily,
    fontWeight: '500',
    marginBottom: spacing(1.5),
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardAuthor: { color: colors.textDim, fontSize: 12, fontWeight: '600', fontFamily, flex: 1 },
  copiedFlag: { color: colors.success, fontSize: 11, fontWeight: '700', fontFamily, marginLeft: spacing(1) },
  heart: { color: colors.textFaint, fontSize: 18, lineHeight: 20 },
  heartActive: { color: colors.danger },
});
