import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';
import { AppThemeProvider, useAppTheme } from '../context/ThemeContext';

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootLayoutContent />
    </AppThemeProvider>
  );
}

function RootLayoutContent() {
  const { isDark } = useAppTheme();

  const customDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#0b0f19',
      card: '#111827',
      text: '#ffffff',
      border: '#1f2937',
    },
  };

  const customLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#f6f8fa',
      card: '#ffffff',
      text: '#111111',
      border: '#e1e3e6',
    },
  };

  return (
    <ThemeProvider value={isDark ? customDarkTheme : customLightTheme}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0f19" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: isDark ? '#0b0f19' : '#f6f8fa',
          },
        }}
      >
        <Stack.Screen 
          name="index" 
        />
        <Stack.Screen 
          name="update/[id]" 
        />
        <Stack.Screen 
          name="profile" 
        />
      </Stack>
    </ThemeProvider>
  );
}
