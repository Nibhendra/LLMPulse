import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ScrollView, 
  Pressable, 
  ActivityIndicator, 
  RefreshControl,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { 
  GoogleAuthProvider, 
  signInWithCredential, 
  signInAnonymously,
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { db, auth } from '../firebase';
import { fetchLatestUpdates, Update } from '../services/updatesService';
import { getFavorites } from '../services/favoritesService';
import { UpdateCard } from '../components/UpdateCard';
import { useAppTheme } from '../context/ThemeContext';

// Complete secure AuthSession WebBrowser redirect binding
WebBrowser.maybeCompleteAuthSession();

const CATEGORIES = [
  { id: 'All', label: 'All Updates', icon: 'grid-outline' },
  { id: 'Saved', label: 'Bookmarks', icon: 'star' },
  { id: 'Claude', label: 'Claude AI', icon: 'sparkles' },
  { id: 'Gemini', label: 'Gemini', icon: 'logo-google' },
  { id: 'OpenAI', label: 'OpenAI', icon: 'hardware-chip' },
  { id: 'Hugging Face', label: 'HuggingFace', icon: 'happy' },
  { id: 'AI Coding Tools', label: 'AI Coding', icon: 'code-slash' },
  { id: 'Open Source Models', label: 'Open Source', icon: 'layers' }
];

const SUGGESTIONS = [
  "What are today's top releases?",
  "Compare Claude 3.7 and OpenAI o1",
  "Summarize the coding tool updates",
  "Are there any Gemini updates?"
];

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: string; // ISO string for easy storage/serialization
}

export default function HomeScreen() {
  const router = useRouter();
  const [allUpdates, setAllUpdates] = useState<Update[]>([]);
  const [displayedUpdates, setDisplayedUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [error, setError] = useState<string | null>(null);
  
  // High-impact spotlight banner item
  const [spotlightItem, setSpotlightItem] = useState<Update | null>(null);

  // Chatbot UI & Messaging States
  const [chatVisible, setChatVisible] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // User auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [gatewayDismissed, setGatewayDismissed] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const bubblesScrollRef = useRef<ScrollView>(null);
  // Stable ref so loadUpdates can read selectedCategory without being a dependency
  const selectedCategoryRef = useRef('All');
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;
  const floatAnim3 = useRef(new Animated.Value(0)).current;
  // Per-category bubble spring scale: keyed by category id
  const bubbleAnims = useRef(
    Object.fromEntries(CATEGORIES.map(c => [c.id, new Animated.Value(1)]))
  ).current;

  // Global theme context
  const { isDark, toggleTheme } = useAppTheme();

  // Looping status breathing and 3D floating animations (Blinkit style)
  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 1500,
          useNativeDriver: true
        })
      ])
    ).start();

    // Floating card 1 (Claude)
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim1, {
          toValue: -6,
          duration: 2000,
          useNativeDriver: true
        }),
        Animated.timing(floatAnim1, {
          toValue: 6,
          duration: 2200,
          useNativeDriver: true
        }),
        Animated.timing(floatAnim1, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true
        })
      ])
    ).start();

    // Floating card 2 (Gemini)
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim2, {
          toValue: 8,
          duration: 2400,
          useNativeDriver: true
        }),
        Animated.timing(floatAnim2, {
          toValue: -8,
          duration: 2200,
          useNativeDriver: true
        }),
        Animated.timing(floatAnim2, {
          toValue: 0,
          duration: 2400,
          useNativeDriver: true
        })
      ])
    ).start();

    // Floating card 3 (OpenAI)
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim3, {
          toValue: -4,
          duration: 1800,
          useNativeDriver: true
        }),
        Animated.timing(floatAnim3, {
          toValue: 4,
          duration: 1900,
          useNativeDriver: true
        }),
        Animated.timing(floatAnim3, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true
        })
      ])
    ).start();

  }, [pulseAnim, floatAnim1, floatAnim2, floatAnim3]);



  // Configure Google Sign-In Native
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "",
    });
  }, []);

  const handleGoogleSignInNative = async () => {
    try {
      setAuthLoading(true);
      setAuthError(null);
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo?.data?.idToken;
      
      if (!idToken) {
        throw new Error("No ID token found.");
      }

      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    } catch (err: any) {
      console.error("Native Google Sign-In Error:", err);
      setAuthError(err?.message || "Google Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Load Guest chats from AsyncStorage
  const loadGuestChats = async () => {
    try {
      const localData = await AsyncStorage.getItem('pulse_guest_chat');
      if (localData) {
        setChatMessages(JSON.parse(localData));
      } else {
        // Default Welcome Message
        const welcome: ChatMessage = {
          id: 'welcome',
          text: "Hello! I am your AI Pulse Intel Assistant. 📈\n\nI am fully loaded with the latest AI updates and model releases currently indexed in your database.\n\nAsk me anything about Claude, OpenAI, Gemini, Hugging Face, or coding tool updates!",
          sender: 'assistant',
          timestamp: new Date().toISOString()
        };
        setChatMessages([welcome]);
        await AsyncStorage.setItem('pulse_guest_chat', JSON.stringify([welcome]));
      }
    } catch (err) {
      console.error("Error loading guest chat:", err);
    }
  };

  // Load Cloud chats from Firestore
  const loadCloudChats = async (userId: string) => {
    try {
      const docRef = doc(db, 'chats', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().messages) {
        setChatMessages(docSnap.data().messages);
      } else {
        const welcome: ChatMessage = {
          id: 'welcome',
          text: "Hello! I am your AI Pulse Intel Assistant. 📈\n\nI am fully loaded with the latest AI updates and model releases currently indexed in your database.\n\nAsk me anything about Claude, OpenAI, Gemini, Hugging Face, or coding tool updates!",
          sender: 'assistant',
          timestamp: new Date().toISOString()
        };
        setChatMessages([welcome]);
        await setDoc(docRef, {
          userId,
          messages: [welcome],
          updatedAt: new Date()
        });
      }
    } catch (err) {
      console.error("Error loading cloud chats:", err);
    }
  };

  // Merge Guest chats with Cloud on Login
  const syncGuestChatsToCloud = async (userId: string, email: string) => {
    try {
      const localData = await AsyncStorage.getItem('pulse_guest_chat');
      const guestMessages = localData ? JSON.parse(localData) : [];
      
      const docRef = doc(db, 'chats', userId);
      const docSnap = await getDoc(docRef);
      
      let cloudMessages = [];
      if (docSnap.exists()) {
        cloudMessages = docSnap.data().messages || [];
      }
      
      const merged = [...cloudMessages];
      
      // Merge guest messages (ignoring duplicates)
      guestMessages.forEach((msg: any) => {
        if (msg.id !== 'welcome' && !merged.some((m: any) => m.id === msg.id)) {
          merged.push(msg);
        }
      });

      // Default welcome if empty
      if (merged.length === 0) {
        merged.push({
          id: 'welcome',
          text: "Hello! I am your AI Pulse Intel Assistant. 📈\n\nI am fully loaded with the latest AI updates and model releases currently indexed in your database.\n\nAsk me anything about Claude, OpenAI, Gemini, Hugging Face, or coding tool updates!",
          sender: 'assistant',
          timestamp: new Date().toISOString()
        });
      }
      
      await setDoc(docRef, {
        userId,
        userEmail: email,
        messages: merged,
        updatedAt: new Date()
      });
      
      // Wipe local guest cache
      await AsyncStorage.removeItem('pulse_guest_chat');
      return merged;
    } catch (err) {
      console.error("Error merging guest chats:", err);
      return null;
    }
  };

  // Listen for user auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      
      if (user) {
        // User logged in! Merge local guest chats into Firestore cloud document
        const merged = await syncGuestChatsToCloud(user.uid, user.email || "Anonymous Profile");
        if (merged) {
          setChatMessages(merged);
        } else {
          // Load existing cloud chats
          await loadCloudChats(user.uid);
        }
      } else {
        // User logged out! Load local guest chats
        await loadGuestChats();
      }
    });
    return unsubscribe;
  }, [allUpdates]);

  // Load updates and search stats
  const applyFilters = useCallback(async (updatesList: Update[], category: string) => {
    let filtered = [...updatesList];

    if (category === 'Saved') {
      // Only Saved requires async look-up – all others filter synchronously
      const favIds = await getFavorites();
      filtered = filtered.filter(item => favIds.includes(item.id));
    } else if (category !== 'All') {
      filtered = filtered.filter(item => item.category === category);
    }
    
    setDisplayedUpdates(filtered);
  }, []);

  const loadUpdates = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const data = await fetchLatestUpdates();
      setAllUpdates(data);
      // Use the ref so this never re-triggers when the user switches categories
      await applyFilters(data, selectedCategoryRef.current);

      // Find the highest importance score update to pin as top promotional card
      if (data.length > 0) {
        const sortedByScore = [...data].sort((a, b) => b.importanceScore - a.importanceScore);
        if (sortedByScore[0].importanceScore >= 8) {
          setSpotlightItem(sortedByScore[0]);
        } else {
          setSpotlightItem(null);
        }
      }
    } catch (err: any) {
      setError("Failed to sync AI signals. Check Firestore or network connection.");
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyFilters]); // ← selectedCategory removed: category switching no longer triggers a full reload

  // Load updates on mount
  useEffect(() => {
    loadUpdates();
  }, [loadUpdates]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUpdates(true);
  }, [loadUpdates]);

  const handleCategoryPress = (categoryId: string) => {
    const categoryIndex = CATEGORIES.findIndex(c => c.id === categoryId);

    // Keep the ref in sync so loadUpdates always has the current value
    selectedCategoryRef.current = categoryId;

    // Instantly update displayed items for non-Saved categories (no async gap = no flicker)
    if (categoryId !== 'Saved') {
      const filtered = categoryId === 'All'
        ? [...allUpdates]
        : allUpdates.filter(item => item.category === categoryId);
      setDisplayedUpdates(filtered);
    } else {
      // Saved needs async favorites look-up
      applyFilters(allUpdates, categoryId);
    }
    setSelectedCategory(categoryId);

    // Spring-pop the tapped bubble: scale up then snap back
    const anim = bubbleAnims[categoryId];
    if (anim) {
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1.15,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
      ]).start();
    }

    // Auto-scroll the bubbles bar to reveal the selected bubble (200ms after re-render settles)
    const BUBBLE_WIDTH = 78;
    const scrollX = Math.max(0, (categoryIndex - 1) * BUBBLE_WIDTH);
    setTimeout(() => {
      bubblesScrollRef.current?.scrollTo({ x: scrollX, animated: true });
    }, 200);

    // Smoothly scroll the feed back to the top
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 200);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Claude': return '#ff6b35'; // Swiggy Orange-Red
      case 'Gemini': return '#4361ee'; // Royal Blue
      case 'OpenAI': return '#10b981'; // Mint Green
      case 'Hugging Face': return '#ec4899'; // Deep Pink
      case 'AI Coding Tools': return '#8b5cf6'; // Violet Purple
      case 'Open Source Models': return '#06b6d4'; // Cyan
      default: return '#7c3aed';
    }
  };

  // Trigger Chatbot Query
  const triggerChatbotQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      text: queryText,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);

    // Save user message locally or in the cloud immediately
    if (currentUser) {
      const docRef = doc(db, 'chats', currentUser.uid);
      await setDoc(docRef, {
        userId: currentUser.uid,
        userEmail: currentUser.email || "Anonymous Profile",
        messages: updatedMessages,
        updatedAt: new Date()
      });
    } else {
      await AsyncStorage.setItem('pulse_guest_chat', JSON.stringify(updatedMessages));
    }

    // Scroll chat list to end
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
      if (!apiKey) {
        throw new Error("Missing exposed key");
      }

      // Compile top 10 news releases as context for Gemini system instruction
      const contextText = allUpdates.slice(0, 10).map(item => 
        `- Tool: ${item.tool}, Company: ${item.company}, Category: ${item.category}, Title: ${item.title}, Summary: ${item.summary}, What Matters: ${item.whyItMatters}`
      ).join("\n");

      const systemInstruction = `You are the LLM Pulse Intelligence Assistant, a helpful conversational AI expert. You are helping developers explore the latest AI updates and model releases. Below is a structured log of the active AI updates in our Firestore database:\n\n${contextText}\n\nUse this database to answer the user's questions. If the user asks about releases not in our database, you can use your general knowledge, but prioritize details from the database when relevant. Answer in a clean, friendly, professional developer companion tone, using markdown bullet points for structured lists where helpful. Keep explanations accessible but technical specs highly accurate.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: `${systemInstruction}\n\nUser Question: ${queryText}` }
                ]
              }
            ]
          })
        }
      );

      const json = await response.json();
      const answer = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      const assistantMsg: ChatMessage = {
        id: Math.random().toString(),
        text: answer || "No response received from the intelligence spectrum. Please try again.",
        sender: 'assistant',
        timestamp: new Date().toISOString()
      };
      
      const finalMessages = [...updatedMessages, assistantMsg];
      setChatMessages(finalMessages);

      // Save assistant message
      if (currentUser) {
        const docRef = doc(db, 'chats', currentUser.uid);
        await setDoc(docRef, {
          userId: currentUser.uid,
          userEmail: currentUser.email || "Anonymous Profile",
          messages: finalMessages,
          updatedAt: new Date()
        });
      } else {
        await AsyncStorage.setItem('pulse_guest_chat', JSON.stringify(finalMessages));
      }
    } catch (err) {
      console.error(err);
      const errMsg: ChatMessage = {
        id: Math.random().toString(),
        text: "Pulse network failure. Please verify EXPO_PUBLIC_GEMINI_API_KEY is configured in your secure local .env file and check your internet connection.",
        sender: 'assistant',
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, errMsg]);
    } finally {
      setChatLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    triggerChatbotQuery(suggestion);
  };

  // Demo Firebase Anonymous Login to bypass client-id wait
  const triggerDemoCloudLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInAnonymously(auth);
    } catch (err: any) {
      console.error("Demo login failure:", err);
      if (err?.code === 'auth/configuration-not-found') {
        setAuthError("Anonymous auth is disabled. Go to Firebase Console > Authentication > Sign-in method and enable 'Anonymous'.");
      } else {
        setAuthError(err?.message || "Sync connection failed. Verify internet connection.");
      }
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthLoading(true);
    try {
      await signOut(auth);
      // Clean chat messages and reload guest
      setChatMessages([]);
      await loadGuestChats();
    } catch (err) {
      console.error("Sign out failure:", err);
    } {
      setAuthLoading(false);
    }
  };

  const handleClearChat = () => {
    Alert.alert(
      'Clear Chat History',
      'Are you sure you want to delete all messages? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            const welcome: ChatMessage = {
              id: '0',
              text: "Chat cleared! I'm your LLM Pulse Intelligence Assistant. Ask me anything about the latest AI models and releases.",
              sender: 'assistant',
              timestamp: new Date().toISOString(),
            };
            setChatMessages([welcome]);
            if (currentUser) {
              const docRef = doc(db, 'chats', currentUser.uid);
              await setDoc(docRef, {
                userId: currentUser.uid,
                messages: [welcome],
                updatedAt: new Date()
              });
            } else {
              await AsyncStorage.setItem('pulse_guest_chat', JSON.stringify([welcome]));
            }
          }
        }
      ]
    );
  };

  // Swiggy & Zepto Style Header + Top promo slider
  // Sticky Top Header Bar (matches premium Swiggy/Blinkit header layouts)
  const renderStickyHeader = () => (
    <View style={[styles.brandRow, isDark ? styles.headerDark : styles.headerLight, { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }]}>
      <View style={styles.locationContainer}>
        <View style={styles.pulseContainer}>
          <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
        </View>
        <Text style={[styles.mainBrandTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
          LLM Pulse
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* Theme toggle pill */}
        <Pressable 
          onPress={toggleTheme}
          style={({ pressed }) => [
            styles.themePill,
            isDark ? styles.themePillDark : styles.themePillLight,
            pressed && styles.pillPressed
          ]}
        >
          <Ionicons 
            name={isDark ? "sunny" : "moon"} 
            size={12} 
            color={isDark ? "#eab308" : "#4b5563"} 
          />
          <Text style={[styles.themeText, isDark ? { color: '#eab308' } : { color: '#4b5563' }]}>
            {isDark ? "LIGHT" : "DARK"}
          </Text>
        </Pressable>

        {/* Profile avatar button */}
        <Pressable
          onPress={() => router.push('/profile')}
          style={({ pressed }) => [
            styles.profileAvatarBtn,
            {
              backgroundColor: currentUser && !currentUser.isAnonymous
                ? 'rgba(124,58,237,0.15)'
                : (isDark ? '#1f2937' : '#f1f5f9'),
              borderColor: currentUser && !currentUser.isAnonymous
                ? '#7c3aed'
                : (isDark ? '#374151' : '#e2e8f0'),
              opacity: pressed ? 0.7 : 1,
            }
          ]}
        >
          {currentUser && !currentUser.isAnonymous ? (
            <Text style={styles.profileAvatarText}>
              {(currentUser.displayName || currentUser.email || 'U').slice(0, 1).toUpperCase()}
            </Text>
          ) : (
            <Ionicons name="person-outline" size={16} color={isDark ? '#9ca3af' : '#4b5563'} />
          )}
        </Pressable>
      </View>
    </View>
  );


  // Sticky Category Bubbles Slider (Permanently accessible under header)
  const renderCategoryBubbles = () => (
    <View style={[
      styles.brandBubblesWrapper, 
      isDark ? styles.headerDark : styles.headerLight,
      isDark ? styles.borderBottomDark : styles.borderBottomLight
    ]}>
      <ScrollView 
        ref={bubblesScrollRef}
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bubblesScroll}
      >
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const activeColor = getCategoryColor(cat.id);
          
          return (
            <Pressable
              key={cat.id}
              onPress={() => handleCategoryPress(cat.id)}
              style={styles.bubbleItem}
            >
              <Animated.View style={[
                styles.bubbleCircle,
                isDark ? styles.bubbleDark : styles.bubbleLight,
                isSelected && { borderColor: activeColor, borderWidth: 2 },
                { 
                  backgroundColor: isSelected ? `${activeColor}15` : (isDark ? '#1f2937' : '#f7fafc'),
                  transform: [{ scale: bubbleAnims[cat.id] }],
                }
              ]}>
                <Ionicons 
                  name={cat.icon as any} 
                  size={20} 
                  color={isSelected ? activeColor : (isDark ? "#9ca3af" : "#4b5563")} 
                />
              </Animated.View>
              <Text style={[
                styles.bubbleLabel,
                isDark ? styles.textSecondaryDark : styles.textSecondaryLight,
                isSelected && { color: activeColor, fontWeight: '800' }
              ]} numberOfLines={1}>
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  // Scrollable dashboard header content (ticker and spotlight card)
  const renderDashboardHeader = () => (
    <View style={styles.headerArea}>
      {/* Sub Header Ticker */}
      <Text style={[styles.telemetryTicker, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
        Ingesting latest AI benchmarks and model release notes • {allUpdates.length} updates online
      </Text>

      {/* Spotlight promo card */}
      {spotlightItem && selectedCategory === 'All' && (
        <View style={styles.spotlightContainer}>
          <Pressable 
            onPress={() => router.push(`/update/${spotlightItem.id}`)}
            style={({ pressed }) => [
              styles.spotlightCard,
              pressed && styles.spotlightPressed
            ]}
          >
            <View style={styles.spotlightHeader}>
              <View style={styles.spotlightBadge}>
                <Ionicons name="trending-up" size={11} color="#ffffff" />
                <Text style={styles.spotlightBadgeText}>RECOMMENDED UPDATE SPOTLIGHT</Text>
              </View>
              <View style={styles.spotlightStarBadge}>
                <Ionicons name="star" size={10} color="#ffffff" />
                <Text style={styles.spotlightStarText}>{spotlightItem.importanceScore.toFixed(1)}</Text>
              </View>
            </View>

            <Text style={styles.spotlightTitle} numberOfLines={2}>
              {spotlightItem.title}
            </Text>

            <Text style={styles.spotlightSummary} numberOfLines={2}>
              {spotlightItem.summary}
            </Text>

            <View style={styles.spotlightFooter}>
              <Text style={styles.spotlightCtaText}>TAP TO READ WHAT CHANGED</Text>
              <Ionicons name="arrow-forward" size={12} color="#ffffff" />
            </View>
          </Pressable>
        </View>
      )}

      {/* Feed list title header */}
      <View style={styles.feedTitleBlock}>
        <Text style={[styles.feedTitleText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
          {selectedCategory === 'All' 
            ? "Today's Pulse Feed" 
            : `${selectedCategory} Updates Feed`
          }
        </Text>
      </View>

    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyCircle, isDark ? styles.emptyBgDark : styles.emptyBgLight]}>
        <Ionicons 
          name={selectedCategory === 'Saved' ? "bookmark-outline" : "planet-outline"} 
          size={36} 
          color={isDark ? "#4b5563" : "#cbd5e1"} 
        />
      </View>
      
      <Text style={[styles.emptyTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
        {selectedCategory === 'Saved' ? "No Bookmarked Updates" : "No Updates in Category"}
      </Text>
      
      <Text style={[styles.emptySubtitle, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
        {selectedCategory === 'Saved' 
          ? "Bookmark articles using the Star icon on update cards to compile your watchlist."
          : `We haven't published any model updates under the "${selectedCategory}" channel yet.`
        }
      </Text>

      {selectedCategory !== 'All' && (
        <Pressable 
          onPress={() => setSelectedCategory('All')}
          style={[styles.resetButton, { backgroundColor: getCategoryColor('All') }]}
        >
          <Text style={styles.resetButtonText}>BACK TO ALL UPDATES</Text>
        </Pressable>
      )}
    </View>
  );

  const renderGatewayScreen = () => {
    return (
      <View style={[styles.gatewayContainer, styles.bgLight]}>

        {/* Holographic Glowing Backdrop Circles */}
        <Animated.View 
          pointerEvents="none"
          style={[
            styles.gatewayGlowCircle1, 
            { 
              transform: [{ scale: Animated.multiply(pulseAnim, 1.2) }],
              opacity: Animated.multiply(pulseAnim, 0.15)
            }
          ]} 
        />
        <Animated.View 
          pointerEvents="none"
          style={[
            styles.gatewayGlowCircle2, 
            { 
              transform: [{ scale: Animated.multiply(pulseAnim, 0.9) }],
              opacity: Animated.multiply(pulseAnim, 0.12)
            }
          ]} 
        />




        <View 
          style={styles.gatewayScrollContent}
        >
          {/* Brand identity area */}
          <View style={styles.gatewayBrandSection}>
            <View style={[styles.gatewayLogoOuter, isDark ? styles.gatewayLogoOuterDark : styles.gatewayLogoOuterLight]}>
              <View style={styles.gatewayLogoInner}>
                <Ionicons name="flash" size={32} color="#ffffff" />
              </View>
            </View>
            <Text style={[styles.gatewayBrandTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              LLM Pulse
            </Text>
            <Text style={[styles.gatewayBrandTagline, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              Latest AI model updates, simplified.
            </Text>
          </View>

          {/* 3D Perspective Floating Updates Showcase */}
          <View 
            pointerEvents="none"
            style={styles.gatewayCardsContainer}
          >
            
            {/* Claude 3.7 Card */}
            <Animated.View 
              style={[
                styles.floatingMiniCard,
                styles.claudeCard,
                isDark ? styles.cardDark : styles.cardLight,
                {
                  transform: [
                    { translateY: floatAnim1 },
                    { rotate: '-5deg' }
                  ],
                  zIndex: 1
                }
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={[styles.modelBadgeDot, { backgroundColor: '#f59e0b' }]} />
                <Text style={[styles.modelBadgeText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>Claude 3.7 Sonnet</Text>
                <Ionicons name="sparkles" size={12} color="#f59e0b" style={{ marginLeft: 'auto' }} />
              </View>
              <Text style={[styles.cardModelTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>Reasoning + Speed</Text>
              <View style={styles.cardProgressBg}>
                <View style={[styles.cardProgressFill, { width: '92.5%', backgroundColor: '#f59e0b' }]} />
              </View>
              <Text style={styles.cardStatsText}>92.5% SWE-bench State-of-the-Art</Text>
            </Animated.View>

            {/* Gemini 2.5 Card */}
            <Animated.View 
              style={[
                styles.floatingMiniCard,
                styles.geminiCard,
                isDark ? styles.cardDark : styles.cardLight,
                {
                  transform: [
                    { translateY: floatAnim2 },
                    { rotate: '4deg' }
                  ],
                  zIndex: 2
                }
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={[styles.modelBadgeDot, { backgroundColor: '#3b82f6' }]} />
                <Text style={[styles.modelBadgeText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>Gemini 2.5 Pro</Text>
                <Ionicons name="videocam" size={12} color="#3b82f6" style={{ marginLeft: 'auto' }} />
              </View>
              <Text style={[styles.cardModelTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>2M Context Window</Text>
              <Text style={[styles.cardSpecsText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                Native multimodal processing for video, audio & complex codebases.
              </Text>
            </Animated.View>

            {/* OpenAI o3-mini Card */}
            <Animated.View 
              style={[
                styles.floatingMiniCard,
                styles.openaiCard,
                isDark ? styles.cardDark : styles.cardLight,
                {
                  transform: [
                    { translateY: floatAnim3 },
                    { rotate: '-2deg' }
                  ],
                  zIndex: 3
                }
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={[styles.modelBadgeDot, { backgroundColor: '#10b981' }]} />
                <Text style={[styles.modelBadgeText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>o3-mini-high</Text>
                <Ionicons name="trending-up" size={12} color="#10b981" style={{ marginLeft: 'auto' }} />
              </View>
              <Text style={[styles.cardModelTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>High-Speed STEM Reasoning</Text>
              <View style={styles.cardLabelRow}>
                <View style={[styles.cardMiniBadge, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <Text style={[styles.cardMiniBadgeText, { color: '#10b981' }]}>50x Faster</Text>
                </View>
                <View style={[styles.cardMiniBadge, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                  <Text style={[styles.cardMiniBadgeText, { color: '#3b82f6' }]}>Code-Gen</Text>
                </View>
              </View>
            </Animated.View>

          </View>

          {/* Grounded Bottom Sheet Sign-In Drawer Card */}
          <View style={[styles.gatewayBottomCard, isDark ? styles.bottomCardDark : styles.bottomCardLight]}>
            <View style={styles.bottomCardHandle} />
            
            <Text style={[styles.bottomCardTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              Welcome to LLM Pulse
            </Text>
            <Text style={[styles.bottomCardSubtitle, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              Your live quick-commerce styled digest for active AI models and developer releases.
            </Text>

            {/* Auth error container if sign-in fails */}
            {authError && (
              <View style={[styles.authErrorContainer, isDark ? styles.errBgDark : styles.errBgLight, { marginBottom: 12 }]}>
                <Ionicons name="warning" size={12} color="#ef4444" style={{ marginRight: 6 }} />
                <Text style={[styles.authErrorText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]} numberOfLines={2}>
                  {authError}
                </Text>
              </View>
            )}

            {/* CTA Section */}
            <View style={styles.gatewayCtaSection}>
              <Pressable 
                disabled={authLoading}
                onPress={() => handleGoogleSignInNative()}
                style={({ pressed }) => [
                  styles.gatewayGoogleBtn,
                  pressed && styles.gatewayBtnPressed,
                  authLoading && { opacity: 0.7 }
                ]}
              >
                {authLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <View style={styles.googleBtnRow}>
                    <Ionicons name="logo-google" size={16} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.gatewayGoogleText}>CONTINUE WITH GOOGLE</Text>
                  </View>
                )}
              </Pressable>

              <Pressable 
                disabled={authLoading}
                onPress={() => setGatewayDismissed(true)}
                style={({ pressed }) => [
                  styles.gatewayGuestBtn,
                  isDark ? styles.gatewayGuestDark : styles.gatewayGuestLight,
                  pressed && styles.gatewayBtnPressed
                ]}
              >
                <Text style={[styles.gatewayGuestText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                  CONTINUE AS GUEST
                </Text>
              </Pressable>
            </View>

            {/* Legal Disclaimer */}
            <Text style={[styles.legalText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              By continuing, you agree to our Terms of Service & Privacy Policy.
            </Text>
          </View>

        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, isDark ? styles.bgDark : styles.bgLight]} edges={['top', 'left', 'right']}>
      {!currentUser && !gatewayDismissed && !loading ? (
        renderGatewayScreen()
      ) : loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color="#7c3aed" />
          <Text style={[styles.loadingText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
            Syncing live updates...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle-outline" size={44} color="#ef4444" />
          <Text style={[styles.errorTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
            PULSE SYNC FAILURE
          </Text>
          <Text style={[styles.errorText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
            {error}
          </Text>
          <Pressable 
            onPress={() => loadUpdates()}
            style={styles.retryBtn}
          >
            <Text style={styles.retryBtnText}>RETRY SYNCING</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Permanent Sticky Top Brand Header */}
          {renderStickyHeader()}

          {/* Permanent Sticky Category Laboratory Selector */}
          {renderCategoryBubbles()}

          <FlatList
            ref={flatListRef}
            data={displayedUpdates}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <UpdateCard 
                update={item} 
                onFavoriteChange={() => applyFilters(allUpdates, selectedCategory)} 
              />
            )}
            ListHeaderComponent={renderDashboardHeader}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={styles.listSpacing}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={isDark ? "#ff6b35" : "#7c3aed"}
                colors={["#7c3aed"]}
              />
            }
          />

          {/* Bottom Floating Action Button (FAB) (Option A) */}
          <Pressable 
            onPress={() => setChatVisible(true)}
            style={({ pressed }) => [
              styles.fab,
              { backgroundColor: getCategoryColor('All') },
              pressed && styles.fabPressed
            ]}
          >
            <Ionicons name="chatbubble-ellipses" size={24} color="#ffffff" />
          </Pressable>
        </View>
      )}

      {/* Slide-Up Bottom Sheet Modal for AI Intel Assistant */}
      <Modal
        visible={chatVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setChatVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setChatVisible(false)} />
          
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.modalSheet, isDark ? styles.sheetDark : styles.sheetLight]}
          >
            {/* Header bar of the modal */}
            <View style={[styles.sheetHeader, isDark ? styles.sheetBorderDark : styles.sheetBorderLight]}>
              <View style={styles.sheetHeaderLeft}>
                <Ionicons name="sparkles" size={16} color="#7c3aed" />
                <Text style={[styles.sheetTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                  AI Pulse Intel Assistant
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {chatMessages.length > 1 && (
                  <Pressable onPress={handleClearChat} style={{ padding: 4 }}>
                    <Ionicons name="trash-outline" size={18} color={isDark ? '#9ca3af' : '#6b7280'} />
                  </Pressable>
                )}
                <Pressable onPress={() => setChatVisible(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={isDark ? "#9ca3af" : "#4b5563"} />
                </Pressable>
              </View>
            </View>

            {/* Auth error banner - shown only when there's an error */}
            {authError && (
              <View style={[styles.authErrorContainer, { marginHorizontal: 16, marginBottom: 8, marginTop: 4 }]}>
                <Ionicons name="warning" size={12} color="#ef4444" style={{ marginRight: 6 }} />
                <Text style={{ color: '#ef4444', fontSize: 12 }} numberOfLines={2}>{authError}</Text>
              </View>
            )}

            {/* List of active chat messages */}
            <FlatList
              ref={flatListRef}
              data={chatMessages}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.chatListContent}
              renderItem={({ item }) => {
                const isUser = item.sender === 'user';
                return (
                  <View style={[styles.messageRow, isUser ? styles.rowUser : styles.rowAssistant]}>
                    {!isUser && (
                      <View style={styles.assistantAvatar}>
                        <Ionicons name="sparkles" size={10} color="#ffffff" />
                      </View>
                    )}
                    <View style={[
                      styles.msgBubble,
                      isUser 
                        ? { backgroundColor: getCategoryColor('All') } 
                        : (isDark ? styles.bubbleBgDark : styles.bubbleBgLight)
                    ]}>
                      <Text style={[
                        styles.msgText,
                        isUser 
                          ? { color: '#ffffff' } 
                          : (isDark ? styles.textPrimaryDark : styles.textPrimaryLight)
                      ]}>
                        {item.text}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />

            {/* Suggestions list when idle */}
            {!chatLoading && chatMessages.length <= 1 && (
              <View style={styles.suggestionsBlock}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestionsScroll}
                >
                  {SUGGESTIONS.map((suggestion) => (
                    <Pressable
                      key={suggestion}
                      onPress={() => handleSuggestionPress(suggestion)}
                      style={[styles.suggestChip, isDark ? styles.chipBgDark : styles.chipBgLight]}
                    >
                      <Text style={[styles.suggestText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                        {suggestion}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Active response loading state */}
            {chatLoading && (
              <View style={styles.loadingBanner}>
                <ActivityIndicator size="small" color="#7c3aed" style={{ marginRight: 6 }} />
                <Text style={[styles.loadingBannerText, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                  Synthesizing release context...
                </Text>
              </View>
            )}

            {/* Input message box */}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
            >
              <View style={[styles.inputContainer, isDark ? styles.sheetBorderDark : styles.sheetBorderLight]}>
                <TextInput
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="Ask about OpenAI, Claude, pricing, spec comparison..."
                  placeholderTextColor={isDark ? "#4b5563" : "#9ca3af"}
                  editable={!chatLoading}
                  style={[styles.chatTextInput, isDark ? styles.inputDark : styles.inputLight]}
                  returnKeyType="send"
                  onSubmitEditing={() => chatInput.trim() && triggerChatbotQuery(chatInput)}
                />
                <Pressable
                  disabled={chatLoading || !chatInput.trim()}
                  onPress={() => triggerChatbotQuery(chatInput)}
                  style={({ pressed }) => [
                    styles.sendButton,
                    { backgroundColor: getCategoryColor('All') },
                    (chatLoading || !chatInput.trim()) && { opacity: 0.5 },
                    pressed && { opacity: 0.8 }
                  ]}
                >
                  <Ionicons name="arrow-up" size={16} color="#ffffff" />
                </Pressable>
              </View>
            </KeyboardAvoidingView>

          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgLight: {
    backgroundColor: '#f6f8fa',
  },
  bgDark: {
    backgroundColor: '#0b0f19',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 10,
  },
  loadingText: {
    fontSize: 10,
    marginTop: 8,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#ef4444',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  retryBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.4,
  },
  headerArea: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseContainer: {
    width: 8,
    height: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff6b35', // Swiggy Orange indicator
  },
  mainBrandTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  themePillLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  themePillDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  pillPressed: {
    opacity: 0.8,
  },
  themeText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  profileAvatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#7c3aed',
    letterSpacing: -0.5,
  },
  telemetryTicker: {
    fontSize: 10.5,
    fontWeight: '600',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  brandBubblesWrapper: {
    paddingVertical: 4,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  bubblesScroll: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  bubbleItem: {
    alignItems: 'center',
    width: 66,
  },
  bubbleCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: 6,
  },
  bubbleLight: {
    shadowColor: '#6b7280',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  bubbleDark: {},
  bubbleLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  spotlightContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  spotlightCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#7c3aed', // Swiggy gradient purple primary
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
    gap: 8,
  },
  spotlightPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  spotlightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spotlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  spotlightBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  spotlightStarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#22c55e', // Green rating
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  spotlightStarText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  spotlightTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  spotlightSummary: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11.5,
    lineHeight: 16.5,
    fontWeight: '500',
  },
  spotlightFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  spotlightCtaText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  feedTitleBlock: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  feedTitleText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  listSpacing: {
    paddingBottom: 88, // space for FAB
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    marginTop: 24,
  },
  emptyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  emptyBgLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  emptyBgDark: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
  },
  emptyTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18.5,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  resetButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.2,
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
  
  // Floating Action Button (FAB) (Option A)
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 999,
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },

  // Modal Slide-Up Sheet
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalSheet: {
    height: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetLight: {
    backgroundColor: '#ffffff',
  },
  sheetDark: {
    backgroundColor: '#111827',
  },
  sheetHeader: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  sheetBorderLight: {
    borderBottomColor: '#edf2f7',
    borderTopColor: '#edf2f7',
  },
  sheetBorderDark: {
    borderBottomColor: '#1f2937',
    borderTopColor: '#1f2937',
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetTitle: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
  },
  
  // Swiggy-Style Authentication Promotion Header Banner
  authHeaderBanner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    justifyContent: 'center',
  },
  authHeaderLight: {
    backgroundColor: '#f7fafc',
  },
  authHeaderDark: {
    backgroundColor: '#161e2e',
  },
  authStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authPromoText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  authActionsGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  authActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  authActLight: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
  },
  authActDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  authActionText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  activeSyncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    marginRight: 8,
  },
  greenTelemetryPulse: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#22c55e',
  },
  authStatusLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  chatListContent: {
    padding: 16,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 2,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    justifyContent: 'flex-start',
  },
  assistantAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  msgBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleBgLight: {
    backgroundColor: '#f1f5f9',
  },
  bubbleBgDark: {
    backgroundColor: '#1f2937',
  },
  msgText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  suggestionsBlock: {
    paddingVertical: 8,
  },
  suggestionsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  suggestChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipBgLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  chipBgDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  suggestText: {
    fontSize: 11,
    fontWeight: '600',
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  loadingBannerText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  chatTextInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    fontSize: 12.5,
    fontWeight: '600',
    borderWidth: 1,
  },
  inputLight: {
    backgroundColor: '#f7fafc',
    borderColor: '#e2e8f0',
    color: '#1a202c',
  },
  inputDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
    color: '#f7fafc',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errBgLight: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  errBgDark: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  authErrorText: {
    fontSize: 9.5,
    fontWeight: '700',
    flex: 1,
    lineHeight: 13,
  },
  gatewayContainer: {
    flex: 1,
    padding: 0,
  },
  gatewayHeaderRow: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  gatewayScrollContent: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingTop: 50,
  },
  gatewayBrandSection: {
    alignItems: 'center',
    marginVertical: 6,
    gap: 6,
    paddingHorizontal: 24,
  },
  gatewayLogoOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 6,
  },
  gatewayLogoOuterLight: {
    backgroundColor: '#ffffff',
    shadowColor: '#7c3aed',
  },
  gatewayLogoOuterDark: {
    backgroundColor: '#1f2937',
    shadowColor: '#000000',
  },
  gatewayLogoInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatewayBrandTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  gatewayBrandTagline: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.8,
  },
  gatewayGlowCircle1: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#7c3aed',
    top: -50,
    right: -50,
    zIndex: 0,
  },
  gatewayGlowCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#3b82f6',
    bottom: 250,
    left: -80,
    zIndex: 0,
  },
  gatewayCardsContainer: {
    width: '100%',
    height: 210,
    position: 'relative',
    marginVertical: 5,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  floatingMiniCard: {
    position: 'absolute',
    width: '78%',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  cardLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: 'rgba(124, 58, 237, 0.15)',
    shadowColor: '#7c3aed',
  },
  cardDark: {
    backgroundColor: 'rgba(22, 28, 42, 0.95)',
    borderColor: 'rgba(124, 58, 237, 0.25)',
    shadowColor: '#000000',
  },
  claudeCard: {
    top: 0,
    left: '6%',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  geminiCard: {
    top: 65,
    right: '6%',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  openaiCard: {
    top: 130,
    left: '10%',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  modelBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  modelBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    opacity: 0.8,
  },
  cardModelTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    marginBottom: 6,
  },
  cardProgressBg: {
    height: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 2.5,
    marginBottom: 4,
    overflow: 'hidden',
  },
  cardProgressFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  cardStatsText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#f59e0b',
  },
  cardSpecsText: {
    fontSize: 10.5,
    lineHeight: 14.5,
    fontWeight: '600',
  },
  cardLabelRow: {
    flexDirection: 'row',
    gap: 6,
  },
  cardMiniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cardMiniBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  gatewayBottomCard: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 10,
    alignItems: 'center',
  },
  bottomCardLight: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderColor: '#e1e3e6',
    shadowColor: '#000000',
  },
  bottomCardDark: {
    backgroundColor: '#161c2a',
    borderTopWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.15)',
    shadowColor: '#000000',
  },
  bottomCardHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    marginBottom: 16,
  },
  bottomCardTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  bottomCardSubtitle: {
    fontSize: 12,
    lineHeight: 16.5,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
    opacity: 0.8,
  },
  gatewayCtaSection: {
    width: '100%',
    gap: 12,
    marginBottom: 8,
  },
  gatewayGoogleBtn: {
    backgroundColor: '#7c3aed',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  googleBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatewayGoogleText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  gatewayGuestBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  gatewayGuestLight: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
  },
  gatewayGuestDark: {
    backgroundColor: '#161c2a',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  gatewayGuestText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  gatewayBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  legalText: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.6,
    textAlign: 'center',
  },
  headerLight: {
    backgroundColor: '#ffffff',
  },
  headerDark: {
    backgroundColor: '#0b0f19',
  },
  borderBottomLight: {
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  borderBottomDark: {
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
});
