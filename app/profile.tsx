import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../firebase';
import { useAppTheme } from '../context/ThemeContext';
import { getFavorites } from '../services/favoritesService';

export default function ProfileScreen() {
  const router = useRouter();
  const { isDark } = useAppTheme();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  // Entry animation
  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsub;
  }, []);

  useEffect(() => {
    getFavorites().then((ids) => setSavedCount(ids.length));
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const isGuest = !currentUser || currentUser.isAnonymous;
  const displayName = isGuest
    ? 'Guest User'
    : currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
  const email = isGuest ? 'Not signed in' : currentUser?.email || '';
  const initials = displayName.slice(0, 2).toUpperCase();
  const avatarColor = isGuest ? '#6b7280' : '#7c3aed';

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      isGuest ? 'Go back to the sign-in screen?' : 'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isGuest ? 'Go to Sign In' : 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut(auth);
            router.replace('/');
          },
        },
      ]
    );
  };

  const bg = isDark ? '#0b0f19' : '#f6f8fa';
  const cardBg = isDark ? '#111827' : '#ffffff';
  const cardBorder = isDark ? '#1f2937' : '#edf2f7';
  const textPrimary = isDark ? '#f7fafc' : '#1a202c';
  const textSecondary = isDark ? '#9ca3af' : '#718096';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      {/* Back header */}
      <View style={[styles.topBar, { backgroundColor: isDark ? '#111827' : '#ffffff', borderBottomColor: cardBorder }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={22} color={textPrimary} />
          <Text style={[styles.backLabel, { color: textPrimary }]}>Back</Text>
        </Pressable>
        <Text style={[styles.topBarTitle, { color: textPrimary }]}>Profile</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Avatar card */}
          <View style={[styles.avatarCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={[styles.avatarCircle, { backgroundColor: avatarColor }]}>
              {isGuest
                ? <Ionicons name="person-outline" size={36} color="#ffffff" />
                : <Text style={styles.avatarInitials}>{initials}</Text>
              }
            </View>

            {/* Status pill */}
            <View style={[
              styles.statusPill,
              { backgroundColor: isGuest ? 'rgba(107,114,128,0.12)' : 'rgba(124,58,237,0.12)' }
            ]}>
              <View style={[styles.statusDot, { backgroundColor: isGuest ? '#6b7280' : '#22c55e' }]} />
              <Text style={[styles.statusText, { color: isGuest ? '#6b7280' : '#22c55e' }]}>
                {isGuest ? 'Guest Mode' : 'Google Account'}
              </Text>
            </View>

            <Text style={[styles.displayName, { color: textPrimary }]}>{displayName}</Text>
            {email ? <Text style={[styles.emailText, { color: textSecondary }]}>{email}</Text> : null}
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Ionicons name="star" size={20} color="#eab308" />
              <Text style={[styles.statNumber, { color: textPrimary }]}>{savedCount}</Text>
              <Text style={[styles.statLabel, { color: textSecondary }]}>Bookmarked</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Ionicons name="shield-checkmark" size={20} color={isGuest ? '#6b7280' : '#7c3aed'} />
              <Text style={[styles.statNumber, { color: textPrimary }]}>
                {isGuest ? 'Guest' : 'Google'}
              </Text>
              <Text style={[styles.statLabel, { color: textSecondary }]}>Auth Method</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Ionicons name="cloud-done" size={20} color="#10b981" />
              <Text style={[styles.statNumber, { color: textPrimary }]}>Live</Text>
              <Text style={[styles.statLabel, { color: textSecondary }]}>Sync Status</Text>
            </View>
          </View>

          {/* Info section */}
          <View style={[styles.infoCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[styles.sectionLabel, { color: textSecondary }]}>ACCOUNT DETAILS</Text>

            <View style={styles.infoRow}>
              <Ionicons name="person-circle-outline" size={18} color={textSecondary} />
              <View style={styles.infoTextBlock}>
                <Text style={[styles.infoKey, { color: textSecondary }]}>Display Name</Text>
                <Text style={[styles.infoValue, { color: textPrimary }]}>{displayName}</Text>
              </View>
            </View>

            <View style={[styles.infoDivider, { backgroundColor: cardBorder }]} />

            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={18} color={textSecondary} />
              <View style={styles.infoTextBlock}>
                <Text style={[styles.infoKey, { color: textSecondary }]}>Email</Text>
                <Text style={[styles.infoValue, { color: textPrimary }]}>
                  {email || '—'}
                </Text>
              </View>
            </View>

            <View style={[styles.infoDivider, { backgroundColor: cardBorder }]} />

            <View style={styles.infoRow}>
              <Ionicons name="finger-print-outline" size={18} color={textSecondary} />
              <View style={styles.infoTextBlock}>
                <Text style={[styles.infoKey, { color: textSecondary }]}>User ID</Text>
                <Text style={[styles.infoValue, { color: textPrimary }]} numberOfLines={1}>
                  {currentUser?.uid || '—'}
                </Text>
              </View>
            </View>
          </View>

          {/* Guest upgrade banner */}
          {isGuest && (
            <View style={[styles.upgradeBanner, { borderColor: '#7c3aed33' }]}>
              <Ionicons name="sparkles" size={18} color="#7c3aed" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.upgradeTitle, { color: textPrimary }]}>Sign in with Google</Text>
                <Text style={[styles.upgradeDesc, { color: textSecondary }]}>
                  Sync your bookmarks and preferences across devices.
                </Text>
              </View>
              <Pressable
                onPress={handleSignOut}
                style={({ pressed }) => [styles.upgradeBtn, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.upgradeBtnText}>Sign In</Text>
              </Pressable>
            </View>
          )}

          {/* Sign out button */}
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.signOutBtn,
              { borderColor: '#ef4444', opacity: pressed ? 0.75 : 1 }
            ]}
          >
            <Ionicons name="log-out-outline" size={18} color="#ef4444" />
            <Text style={styles.signOutText}>
              {isGuest ? 'Switch to Google Sign-In' : 'Sign Out'}
            </Text>
          </Pressable>

          <Text style={[styles.versionText, { color: textSecondary }]}>
            LLM Pulse • v1.0.0 • Built with ❤️
          </Text>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 64,
  },
  backLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  avatarCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarInitials: {
    fontSize: 30,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  emailText: {
    fontSize: 13,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 2,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 5,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 4,
    marginBottom: 2,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  infoTextBlock: {
    flex: 1,
    gap: 2,
  },
  infoKey: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  infoValue: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  infoDivider: {
    height: 1,
  },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(124,58,237,0.05)',
    marginBottom: 2,
  },
  upgradeTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  upgradeDesc: {
    fontSize: 11.5,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 2,
  },
  upgradeBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  upgradeBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 2,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ef4444',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 8,
  },
});
