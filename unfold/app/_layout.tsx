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
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FontProvider } from '../src/components/ui';
import { StoreProvider } from '../src/store';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
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
    <SafeAreaProvider>
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
                contentStyle: { backgroundColor: '#E7F1EE' },
                animation: 'slide_from_right',
              }}
            />
          </View>
        </StoreProvider>
      </FontProvider>
    </SafeAreaProvider>
  );
}
