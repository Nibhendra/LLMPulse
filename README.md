# LLM Pulse 📈🧠

**Your daily radar for the AI revolution.**

Keeping up with AI is a full-time job. Between new model drops, benchmark records, and open-source breakthroughs, the noise is deafening. **LLM Pulse** is a premium, real-time mobile app designed to cut through the clutter and deliver high-signal AI updates straight to your pocket.

---

## ✨ Features

- **Live AI Radar**: Real-time updates categorized across major labs (OpenAI, Google Gemini, Anthropic Claude, Hugging Face, AI Coding Tools, and Open Source).
- **Impact Scores**: Every update is algorithmicly rated (out of 10) so you know instantly if it's a minor patch or a massive breakthrough.
- **"Why It Matters" Summaries**: Bite-sized executive takeaways attached to every update card so you don't have to read 20-page whitepapers.
- **Premium 3D UI/UX**: Built with 60fps 3D-perspective floating cards, holographic glowing backdrops, spring-physics interactions, and a Blinkit-inspired bottom-sheet gateway.
- **Dark/Light Mode**: Seamlessly switch between curated Dark and Light themes.
- **Cloud Sync & Bookmarks**: Native Google Sign-In lets you securely bookmark your favorite benchmarks and sync your reading list across all your devices via Firebase.
- **Guest Mode**: Full read-only access for users who prefer to browse without an account.

## 🛠 Tech Stack

- **Frontend Framework**: [React Native](https://reactnative.dev/) with [Expo (SDK 54)](https://expo.dev/)
- **Language**: TypeScript
- **Navigation**: Expo Router (File-based routing)
- **UI & Animations**: React Native `Animated` API with native driver for buttery smooth 3D transforms.
- **Authentication**: Firebase Auth paired with `@react-native-google-signin/google-signin` for native Android Play Services bottom-sheet login.
- **Database**: Firebase Firestore (real-time cloud syncing for feeds and bookmarks).

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Android Studio / Android SDK (for local builds)
- A Firebase project (for the database and Auth)

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/Nibhendra/LLMPulse.git
cd LLMPulse
npm install
```

### 2. Environment Setup
You will need to configure Firebase and Google OAuth. 
1. Create a `.env` file in the root directory.
2. Add your Firebase config keys:
```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_google_web_client_id
```
3. **Android Native Auth:** Download your `google-services.json` from the Firebase Console and place it in the root directory.

### 3. Running the App
To run the app locally on an emulator or physical device using Expo Go:
```bash
npx expo start
```
*Note: Native Google Sign-In requires a standalone build and will not work inside the standard Expo Go app.*

### 4. Building the APK
To build the standalone APK locally using your machine's CPU (requires Android SDK):
```bash
npx expo prebuild --platform android --clean
cd android && gradlew assembleRelease
```
The APK will be located in `android/app/build/outputs/apk/release/`.

---

*Built with ❤️ for the AI community.*
