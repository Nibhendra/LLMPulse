import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../firebase';

export interface Update {
  id: string;
  title: string;
  tool: string;
  company: string;
  category: 'Claude' | 'Gemini' | 'OpenAI' | 'Hugging Face' | 'AI Coding Tools' | 'Open Source Models';
  summary: string;
  whyItMatters: string;
  beginnerExplanation: string;
  developerExplanation: string;
  importanceScore: number;
  tags: string[];
  originalUrl: string;
  sourceName: string;
  publishedAt: { seconds: number; nanoseconds: number } | string | Date;
  createdAt: { seconds: number; nanoseconds: number };
}

/**
 * Helper to parse publishedAt field into a Javascript Date
 */
export function getPublishedDate(update: Update): Date {
  if (!update.publishedAt) return new Date();
  
  // If it's a Firestore Timestamp from Web SDK or backend Admin SDK
  if (typeof update.publishedAt === 'object' && 'seconds' in update.publishedAt) {
    return new Date(update.publishedAt.seconds * 1000);
  }
  
  // If it's an ISO String or other date representation
  return new Date(update.publishedAt);
}

/**
 * Fetch all updates from Firestore, sorted by publishedAt descending.
 * @param category - Optional category filter (e.g. 'Claude', 'Gemini')
 * @returns Array of Update items
 */
export async function fetchLatestUpdates(category?: string): Promise<Update[]> {
  try {
    const updatesCol = collection(db, 'updates');
    
    // Simple query on publishedAt. Since we only sort, Firestore's automatic single-field index handles this.
    // We fetch a slightly larger limit (e.g. 100) to ensure we have plenty of filtered options.
    const q = query(
      updatesCol,
      orderBy('publishedAt', 'desc'),
      limit(100)
    );

    const snapshot = await getDocs(q);
    let updates: Update[] = [];
    
    snapshot.forEach((doc) => {
      updates.push({
        id: doc.id,
        ...doc.data()
      } as Update);
    });

    // Perform category filtering in-memory to avoid requiring a composite Firestore index!
    if (category && category !== 'All') {
      updates = updates.filter(item => item.category === category || category === 'Saved');
    }

    return updates;
  } catch (error) {
    console.error("Error fetching updates from Firestore:", error);
    throw error;
  }
}

/**
 * Fetch a single update details by document ID.
 * @param id - Document ID in Firestore
 * @returns Update details or null if not found
 */
export async function fetchUpdateById(id: string): Promise<Update | null> {
  try {
    const docRef = doc(db, 'updates', id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Update;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching update with ID ${id}:`, error);
    throw error;
  }
}
