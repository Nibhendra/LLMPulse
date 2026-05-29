import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Pressable, 
  ActivityIndicator, 
  Share
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fetchUpdateById, Update, getPublishedDate } from '../../services/updatesService';
import { isFavorite, toggleFavorite } from '../../services/favoritesService';
import { useAppTheme } from '../../context/ThemeContext';

export default function UpdateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [update, setUpdate] = useState<Update | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);

  // Consume the global manual theme context
  const { isDark } = useAppTheme();

  useEffect(() => {
    async function loadDetail() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchUpdateById(id);
        if (data) {
          setUpdate(data);
          const fav = await isFavorite(data.id);
          setIsFav(fav);
        } else {
          setError("This update could not be found.");
        }
      } catch (err) {
        setError("Failed to connect to the database. Verify network/configuration.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [id]);

  const handleOpenSource = async () => {
    if (update?.originalUrl) {
      await WebBrowser.openBrowserAsync(update.originalUrl);
    }
  };

  const handleFavoriteToggle = async () => {
    if (!update) return;
    const added = await toggleFavorite(update.id);
    setIsFav(added);
  };

  const handleShare = async () => {
    if (!update) return;
    try {
      await Share.share({
        title: update.title,
        message: `LLM Pulse: "${update.title}" (${update.tool} by ${update.company})\n\nSummary: ${update.summary}\n\nRead more at: ${update.originalUrl}`,
      });
    } catch (err) {
      console.error("Error sharing:", err);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, isDark ? styles.bgDark : styles.bgLight]}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={[styles.infoText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
          Syncing update dossier...
        </Text>
      </View>
    );
  }

  if (error || !update) {
    return (
      <View style={[styles.centerContainer, isDark ? styles.bgDark : styles.bgLight]}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={[styles.errorTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
          Update Dossier Empty
        </Text>
        <Text style={[styles.errorText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
          {error || "Update details are currently unavailable."}
        </Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Return to Pulse Feed</Text>
        </Pressable>
      </View>
    );
  }

  const publishedDate = getPublishedDate(update);
  const formattedDate = publishedDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

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
    <SafeAreaView style={[styles.safeContainer, isDark ? styles.bgDark : styles.bgLight]} edges={['top', 'left', 'right', 'bottom']}>
      
      {/* Translucent Navigation Header Bar */}
      <View style={[styles.headerRow, isDark ? styles.headerRowDark : styles.headerRowLight]}>
        <Pressable 
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.circularBackBtn,
            isDark ? styles.backBtnDark : styles.backBtnLight,
            pressed && styles.btnPressed
          ]}
        >
          <Ionicons name="arrow-back" size={16} color={isDark ? "#ffffff" : "#0f172a"} />
        </Pressable>

        <Text style={[styles.headerIntelText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
          Update Details
        </Text>

        <View style={styles.headerRightActions}>
          <Pressable 
            onPress={handleFavoriteToggle}
            style={({ pressed }) => [
              styles.circularBackBtn,
              isDark ? styles.backBtnDark : styles.backBtnLight,
              isFav && { borderColor: '#eab308', backgroundColor: 'rgba(234, 179, 8, 0.1)' },
              pressed && styles.btnPressed
            ]}
          >
            <Ionicons 
              name={isFav ? "star" : "star-outline"} 
              size={15} 
              color={isFav ? "#eab308" : (isDark ? "#ffffff" : "#0f172a")} 
            />
          </Pressable>

          <Pressable 
            onPress={handleShare}
            style={({ pressed }) => [
              styles.circularBackBtn,
              isDark ? styles.backBtnDark : styles.backBtnLight,
              pressed && styles.btnPressed
            ]}
          >
            <Ionicons name="share-social-outline" size={15} color={isDark ? "#ffffff" : "#0f172a"} />
          </Pressable>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Brand category banner and Rating Review pill */}
        <View style={styles.metaRow}>
          <View style={[styles.categoryBadge, { backgroundColor: `${categoryColor}12` }]}>
            <Text style={[styles.categoryText, { color: categoryColor }]}>
              {update.category}
            </Text>
          </View>
          
          {/* Swiggy Star review block */}
          <View style={[styles.ratingBadge, { backgroundColor: `${ratingColor}15` }]}>
            <Ionicons name="star" size={12} color={ratingColor} />
            <Text style={[styles.ratingText, { color: ratingColor }]}>
              {update.importanceScore.toFixed(1)} <Text style={styles.ratingTextMax}>Impact Score</Text>
            </Text>
          </View>
        </View>

        {/* Large Core Title */}
        <Text style={[styles.title, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
          {update.title}
        </Text>

        {/* Telemetry info cards structured in grid */}
        <View style={[styles.telemetryGrid, isDark ? styles.gridDark : styles.gridLight]}>
          <View style={styles.gridCell}>
            <Text style={[styles.cellLabel, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>AI ACCELERATOR</Text>
            <Text style={[styles.cellValue, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>{update.tool}</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={[styles.cellLabel, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>LABORATORY</Text>
            <Text style={[styles.cellValue, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>{update.company}</Text>
          </View>
          <View style={[styles.gridCell, { borderRightWidth: 0 }]}>
            <Text style={[styles.cellLabel, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>PUBLISHED FEED</Text>
            <Text style={[styles.cellValue, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]} numberOfLines={1}>
              {update.sourceName}
            </Text>
          </View>
        </View>

        <Text style={[styles.dateText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
          UPDATE DETECTED • {formattedDate.toUpperCase()}
        </Text>

        {/* Executive Summary */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: categoryColor }]}>EXECUTIVE SUMMARY</Text>
          <View style={styles.summaryWrapper}>
            <Text style={[styles.summaryBody, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              {update.summary}
            </Text>
          </View>
        </View>

        {/* Why it Matters highlight */}
        <View style={[styles.section, styles.highlightBox, isDark ? styles.boxDark : styles.boxLight, { borderLeftColor: categoryColor }]}>
          <Text style={[styles.sectionTitle, { color: categoryColor, marginBottom: 4 }]}>💡 WHY IT MATTERS</Text>
          <Text style={[styles.bodyText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
            {update.whyItMatters}
          </Text>
        </View>

        {/* Simple Explanation pastel card bubble (Zepto styled highlight note) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="bulb-outline" size={15} color="#eab308" />
            <Text style={[styles.sectionTitleText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              Simple Explanation
            </Text>
          </View>
          <View style={[
            styles.explanationCard,
            isDark ? styles.cardDark : styles.cardLight,
            isDark ? { backgroundColor: '#1e293b1a', borderColor: '#374151' } : { backgroundColor: '#fefcbf40', borderColor: '#fef08a' },
            { borderLeftColor: '#eab308' }
          ]}>
            <Text style={[styles.bodyText, isDark ? styles.bodyTextDark : styles.bodyTextLight]}>
              {update.beginnerExplanation}
            </Text>
          </View>
        </View>

        {/* Developer Deep Dive Technical specs box (Stripe / Tailwind style modern document view) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="document-text-outline" size={15} color={categoryColor} />
            <Text style={[styles.sectionTitleText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              Technical Specifications
            </Text>
          </View>
          
          <View style={[styles.specsFrame, isDark ? styles.specsDark : styles.specsLight]}>
            <View style={[styles.specsHeader, isDark ? styles.specsHeaderDark : styles.specsHeaderLight]}>
              <Ionicons name="settings-outline" size={12} color={isDark ? "#9ca3af" : "#4b5563"} />
              <Text style={[styles.specsHeaderText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>SYSTEM SPECIFICATION MATRIX</Text>
            </View>
            <View style={styles.specsContent}>
              <Text style={[styles.specsText, isDark ? styles.specsTextDark : styles.specsTextLight]}>
                {update.developerExplanation}
              </Text>
            </View>
          </View>
        </View>

        {/* Tags Block */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
            CORE META CATEGORIES
          </Text>
          <View style={styles.tagsContainer}>
            {update.tags.map((tag) => (
              <View key={tag} style={[styles.tagBadge, isDark ? styles.tagDark : styles.tagLight]}>
                <Text style={[styles.tagText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                  #{tag.toLowerCase()}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Swiggy Orange style full launcher button */}
        <View style={styles.actionsBox}>
          <Pressable 
            onPress={handleOpenSource}
            style={({ pressed }) => [
              styles.sourceButton,
              { backgroundColor: getCategoryColor('All') },
              pressed && styles.btnPressed
            ]}
          >
            <Ionicons name="open-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.sourceButtonText}>LAUNCH CORE SOURCE ARTICLE</Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
  },
  bgLight: {
    backgroundColor: '#f6f8fa',
  },
  bgDark: {
    backgroundColor: '#0b0f19',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  infoText: {
    fontSize: 11,
    fontWeight: '700',
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ef4444',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 11,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerRowLight: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#edf2f7',
  },
  headerRowDark: {
    backgroundColor: '#111827',
    borderBottomColor: '#1f2937',
  },
  circularBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  backBtnLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  backBtnDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  headerIntelText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerRightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
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
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 10.5,
    fontWeight: '900',
  },
  ratingTextMax: {
    fontSize: 9,
    fontWeight: '600',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 25,
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  telemetryGrid: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    marginBottom: 12,
  },
  gridLight: {
    backgroundColor: '#ffffff',
    borderColor: '#edf2f7',
  },
  gridDark: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
  },
  gridCell: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 0.5,
    borderRightColor: '#e2e8f0',
    paddingHorizontal: 6,
  },
  cellLabel: {
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  cellValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 18,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  summaryWrapper: {
    paddingHorizontal: 4,
  },
  summaryBody: {
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: '500',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitleText: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  highlightBox: {
    padding: 14,
    borderRadius: 14,
    borderLeftWidth: 3.5,
  },
  boxLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  boxDark: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
  },
  explanationCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3.5,
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  cardDark: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  bodyTextLight: {
    color: '#4a5568',
  },
  bodyTextDark: {
    color: '#cbd5e1',
  },
  specsFrame: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  specsLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  specsDark: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
  },
  specsHeader: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
  },
  specsHeaderLight: {
    backgroundColor: '#f7fafc',
    borderBottomColor: '#e2e8f0',
  },
  specsHeaderDark: {
    backgroundColor: '#1f2937',
    borderBottomColor: '#374151',
  },
  specsHeaderText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  specsContent: {
    padding: 14,
  },
  specsText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  specsTextLight: {
    color: '#2d3748',
  },
  specsTextDark: {
    color: '#e2e8f0',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagLight: {
    backgroundColor: '#ffffff',
    borderColor: '#edf2f7',
  },
  tagDark: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
  },
  tagText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  actionsBox: {
    marginTop: 24,
  },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
  },
  sourceButtonText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.4,
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
});
