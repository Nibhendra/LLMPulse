import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Share, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Update, getPublishedDate } from '../services/updatesService';
import { isFavorite, toggleFavorite } from '../services/favoritesService';
import { useAppTheme } from '../context/ThemeContext';

interface UpdateCardProps {
  update: Update;
  onFavoriteChange?: () => void;
}

export function UpdateCard({ update, onFavoriteChange }: UpdateCardProps) {
  const router = useRouter();
  const { isDark } = useAppTheme();
  const [isFav, setIsFav] = useState(false);

  // 3D press animation values
  const pressScale = useRef(new Animated.Value(1)).current;
  const pressTiltY = useRef(new Animated.Value(0)).current;
  const pressElevation = useRef(new Animated.Value(1)).current;

  // Entry slide-up + fade animation
  const entryOpacity = useRef(new Animated.Value(0)).current;
  const entryTranslateY = useRef(new Animated.Value(22)).current;

  useEffect(() => {
    // Slide up and fade in on mount
    Animated.parallel([
      Animated.timing(entryOpacity, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.spring(entryTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(pressScale, {
        toValue: 0.97,
        friction: 5,
        tension: 180,
        useNativeDriver: true,
      }),
      Animated.spring(pressTiltY, {
        toValue: 4,
        friction: 5,
        tension: 180,
        useNativeDriver: true,
      }),
      Animated.timing(pressElevation, {
        toValue: 0.6,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(pressScale, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.spring(pressTiltY, {
        toValue: 0,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(pressElevation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const publishedDate = getPublishedDate(update);
  const formattedDate = publishedDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const handleFavoritePress = async (e: any) => {
    e.stopPropagation();
    const added = await toggleFavorite(update.id);
    setIsFav(added);
    if (onFavoriteChange) {
      onFavoriteChange();
    }
  };

  const handleSharePress = async (e: any) => {
    e.stopPropagation();
    try {
      await Share.share({
        title: update.title,
        message: `📈 LLM Pulse: "${update.title}" (${update.tool} by ${update.company})\n\nImpact Score: ${update.importanceScore}/10\n\nSummary: ${update.summary}\n\nRead more at: ${update.originalUrl}`,
      });
    } catch (error) {
      console.error("Error sharing article:", error);
    }
  };

  // Check if bookmarked on mount
  useEffect(() => {
    async function checkFav() {
      const fav = await isFavorite(update.id);
      setIsFav(fav);
    }
    checkFav();
  }, [update.id]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Claude': return '#ff6b35';
      case 'Gemini': return '#4361ee';
      case 'OpenAI': return '#10b981';
      case 'Hugging Face': return '#ec4899';
      case 'AI Coding Tools': return '#8b5cf6';
      case 'Open Source Models': return '#06b6d4';
      default: return '#7c3aed';
    }
  };

  const categoryColor = getCategoryColor(update.category);

  const getRatingColor = (score: number) => {
    if (score >= 8) return '#22c55e';
    if (score >= 6) return '#eab308';
    return '#f97316';
  };

  const ratingColor = getRatingColor(update.importanceScore);

  return (
    <Animated.View
      style={{
        opacity: entryOpacity,
        transform: [
          { translateY: entryTranslateY },
          { scale: pressScale },
          { translateY: pressTiltY },
        ],
      }}
    >
      <Pressable
        onPress={() => router.push(`/update/${update.id}`)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
          isDark ? styles.cardDark : styles.cardLight,
        ]}
      >

        {/* Top Banner Row */}
        <View style={styles.cardHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: `${categoryColor}12` }]}>
            <Text style={[styles.categoryText, { color: categoryColor }]}>
              {update.category}
            </Text>
          </View>
          
          {/* Rating Badge */}
          <View style={[styles.ratingBadge, { backgroundColor: `${ratingColor}15` }]}>
            <Ionicons name="star" size={11} color={ratingColor} />
            <Text style={[styles.ratingText, { color: ratingColor }]}>
              {update.importanceScore.toFixed(1)}
            </Text>
          </View>
        </View>

        {/* Main Info Area */}
        <View style={styles.contentBlock}>
          <Text style={[styles.title, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
            {update.title}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.metaText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              {update.tool}
            </Text>
            <View style={[styles.dotDivider, { backgroundColor: isDark ? '#374151' : '#cbd5e1' }]} />
            <Text style={[styles.metaText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              {update.sourceName}
            </Text>
            <View style={[styles.dotDivider, { backgroundColor: isDark ? '#374151' : '#cbd5e1' }]} />
            <Text style={[styles.metaText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              {formattedDate}
            </Text>
          </View>
        </View>

        {/* Executive Summary */}
        <Text
          numberOfLines={2}
          style={[styles.summary, isDark ? styles.summaryTextDark : styles.summaryTextLight]}
        >
          {update.summary}
        </Text>

        {/* Why It Matters Box */}
        <View style={[styles.mattersSection, isDark ? styles.mattersDark : styles.mattersLight]}>
          <Text style={[styles.mattersLabel, { color: categoryColor }]}>
            💡 WHY IT MATTERS
          </Text>
          <Text
            numberOfLines={2}
            style={[styles.mattersText, isDark ? styles.mattersTextDark : styles.mattersTextLight]}
          >
            {update.whyItMatters}
          </Text>
        </View>

        {/* Divider */}
        <View style={[styles.divider, isDark ? styles.dividerDark : styles.dividerLight]} />

        {/* Card Footer Actions */}
        <View style={styles.cardFooter}>
          <View style={styles.footerBrand}>
            <View style={[styles.brandPulseDot, { backgroundColor: categoryColor }]} />
            <Text style={[styles.brandLabel, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              Indexed Update
            </Text>
          </View>

          <View style={styles.footerActions}>
            <Pressable
              onPress={handleFavoritePress}
              style={({ pressed }) => [
                styles.iconActionButton,
                isDark ? styles.iconButtonDark : styles.iconButtonLight,
                isFav && { borderColor: '#eab308', backgroundColor: 'rgba(234, 179, 8, 0.1)' },
                pressed && styles.actionPressed
              ]}
            >
              <Ionicons
                name={isFav ? "star" : "star-outline"}
                size={15}
                color={isFav ? "#eab308" : (isDark ? "#9ca3af" : "#4b5563")}
              />
            </Pressable>

            <Pressable
              onPress={handleSharePress}
              style={({ pressed }) => [
                styles.iconActionButton,
                isDark ? styles.iconButtonDark : styles.iconButtonLight,
                pressed && styles.actionPressed
              ]}
            >
              <Ionicons
                name="share-social-outline"
                size={15}
                color={isDark ? "#9ca3af" : "#4b5563"}
              />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#edf2f7',
    shadowColor: '#6b7280',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
  },
  cardDark: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 10.5,
    fontWeight: '900',
  },
  contentBlock: {
    gap: 6,
    marginBottom: 10,
  },
  title: {
    fontSize: 15.5,
    fontWeight: '800',
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  dotDivider: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.7,
  },
  summary: {
    fontSize: 12.5,
    lineHeight: 18.5,
    fontWeight: '400',
    marginBottom: 12,
  },
  mattersSection: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
    gap: 4,
  },
  mattersLight: {
    backgroundColor: '#f7fafc',
  },
  mattersDark: {
    backgroundColor: '#1f2937',
  },
  mattersLabel: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  mattersText: {
    fontSize: 12.5,
    lineHeight: 17.5,
    fontWeight: '500',
  },
  mattersTextLight: {
    color: '#4a5568',
  },
  mattersTextDark: {
    color: '#cbd5e1',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  dividerLight: {
    backgroundColor: '#edf2f7',
  },
  dividerDark: {
    backgroundColor: '#1f2937',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  brandLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  iconButtonDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  actionPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  textPrimaryLight: {
    color: '#1a202c',
  },
  textPrimaryDark: {
    color: '#f7fafc',
  },
  textSecondaryLight: {
    color: '#718096',
  },
  textSecondaryDark: {
    color: '#a0aec0',
  },
  summaryTextLight: {
    color: '#4a5568',
  },
  summaryTextDark: {
    color: '#cbd5e1',
  },
});
