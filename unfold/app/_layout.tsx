import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FontProvider } from '../src/components/ui';
import { StoreProvider } from '../src/store';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const WEB_SHELL_CSS = `
  #unfold-app {
    position: fixed !important;
    inset: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    height: 100dvh !important;
    min-height: 100dvh !important;
  }
  [data-unfold-screen] {
    flex: 1 1 auto !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 100% !important;
  }
  [data-unfold-frame] {
    flex: 1 1 auto !important;
    width: 100% !important;
    max-width: 440px !important;
    height: 100% !important;
    min-height: 100% !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
`;

function useWebShell() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.setAttribute('data-unfold-shell', '');
    style.textContent = WEB_SHELL_CSS;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);
}

export default function RootLayout() {
  useWebShell();
  const [loaded, error] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <View nativeID="unfold-app" style={{ flex: 1 }}>
      <SafeAreaProvider style={{ flex: 1 }}>
        <FontProvider
          fonts={
            loaded
              ? {
                  medium: 'PlusJakartaSans_500Medium',
                  semibold: 'PlusJakartaSans_600SemiBold',
                  bold: 'PlusJakartaSans_700Bold',
                  extrabold: 'PlusJakartaSans_800ExtraBold',
                }
              : {}
          }
        >
          <StoreProvider>
            <StatusBar style="dark" />
            <View style={{ flex: 1, backgroundColor: '#E7F1EE' }}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { flex: 1, backgroundColor: '#E7F1EE' },
                  animation: 'slide_from_right',
                }}
              />
            </View>
          </StoreProvider>
        </FontProvider>
      </SafeAreaProvider>
    </View>
  );
}
