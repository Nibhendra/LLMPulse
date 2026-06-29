const path = require('path');
// Load .env from parent directory (root of project)
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Parser = require('rss-parser');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, query, where, Timestamp } = require('firebase/firestore');
const { summarizeWithGemini } = require('./summarizeWithGemini');
const sources = require('./sources');

// Initialize Firebase using Web SDK configs (works in Node.js!)
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// Check if variables are loaded
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("Firebase environment variables are missing! Make sure the .env file is in the root of the project.");
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const parser = new Parser({
  customFields: {
    item: [['content:encoded', 'contentEncoded']],
  }
});

/**
 * Checks if an article URL already exists in Firestore updates collection.
 * @param {string} url - The article URL
 * @returns {Promise<boolean>}
 */
async function checkDuplicate(url) {
  try {
    const q = query(collection(db, "updates"), where("originalUrl", "==", url));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error(`Error checking duplicate for ${url}:`, error);
    return false;
  }
}

/**
 * Runs the orchestrator script
 */
async function fetchAndProcessUpdates() {
  console.log("Starting LLM Pulse fetch script...");
  const updatesCol = collection(db, "updates");

  for (const source of sources) {
    console.log(`\nFetching updates from: ${source.name} (${source.feedUrl})...`);
    
    let response;
    let rawText;
    let feed;

    const urlsToTry = source.feedUrlFallback 
      ? [source.feedUrl, ...source.feedUrlFallback] 
      : [source.feedUrl];

    try {
      for (let u = 0; u < urlsToTry.length; u++) {
        const currentUrl = urlsToTry[u];
        try {
          response = await fetch(currentUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          if (response.ok) {
            rawText = await response.text();
            break; // Successfully fetched, stop trying other URLs
          } else if (u === urlsToTry.length - 1) {
            throw new Error(`Status code ${response.status}`);
          }
        } catch (err) {
          if (u === urlsToTry.length - 1) {
            throw err;
          }
          console.log(`Failed to fetch from ${currentUrl}, trying fallback...`);
        }
      }

      // Sanitize raw '&' signs that are not already part of valid XML entities
      const sanitizedText = rawText.replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;');
      
      feed = await parser.parseString(sanitizedText);
      console.log(`Found ${feed.items.length} items in feed.`);

      // Process only the top 3 most recent articles per run to save API usage and speed up execution
      const itemsToProcess = feed.items.slice(0, 3);

      for (const item of itemsToProcess) {
        const url = item.link || item.guid || "";
        const title = item.title || "No Title";
        const content = item.contentSnippet || item.contentEncoded || item.content || "";

        if (!url) {
          console.log(`Skipping item "${title}" as it has no URL.`);
          continue;
        }

        const isDuplicate = await checkDuplicate(url);
        if (isDuplicate) {
          console.log(`Skipping duplicate: "${title}" (${url})`);
          continue;
        }

        console.log(`New article found! Summarizing: "${title}"`);
        
        try {
          // Get Gemini summary
          const structuredData = await summarizeWithGemini(title, content, source);
          
          // Construct Firestore document
          const docData = {
            ...structuredData,
            originalUrl: url,
            sourceName: source.name,
            publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            createdAt: Timestamp.now()
          };

          // Save to Firestore
          const docRef = await addDoc(updatesCol, docData);
          console.log(`Successfully saved to Firestore! Doc ID: ${docRef.id}`);

        } catch (geminiOrDbError) {
          console.error(`Failed to process item "${title}":`, geminiOrDbError);
        }
      }

    } catch (feedError) {
      console.error(`Error fetching/parsing feed ${source.name}:`, feedError.message);
    }
  }

  console.log("\nLLM Pulse fetch script run completed!");
  process.exit(0);
}

fetchAndProcessUpdates();
