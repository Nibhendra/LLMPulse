import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = '@llm_radar_favorites';

/**
 * Fetch all favorited Update document IDs from AsyncStorage.
 */
export async function getFavorites(): Promise<string[]> {
  try {
    const jsonValue = await AsyncStorage.getItem(FAVORITES_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error("Error getting favorites:", e);
    return [];
  }
}

/**
 * Check if a specific Update document ID is bookmarked.
 */
export async function isFavorite(id: string): Promise<boolean> {
  const favorites = await getFavorites();
  return favorites.includes(id);
}

/**
 * Add or remove an Update document ID from device favorites storage.
 * @returns boolean - true if added, false if removed
 */
export async function toggleFavorite(id: string): Promise<boolean> {
  try {
    const favorites = await getFavorites();
    const index = favorites.indexOf(id);
    let updated: string[];
    
    if (index > -1) {
      favorites.splice(index, 1);
      updated = [...favorites];
    } else {
      updated = [...favorites, id];
    }
    
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    return index === -1; // returns true if bookmarked, false if removed
  } catch (e) {
    console.error("Error toggling favorite:", e);
    return false;
  }
}
