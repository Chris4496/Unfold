import { useRouter } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';
import { useStore } from '../store';
import { colors } from '../theme';
import { T } from './ui';

export function DemoContext() {
  const store = useStore();
  const router = useRouter();
  if (!store.isDemo) return null;

  return (
    <View accessibilityLabel="Fictional student demo context" style={{ paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#E7F1EE', borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <T size={12} weight="bold" color={colors.tealDark}>Fictional demo · Maya, a Hong Kong university student · 18 simulated text notes over three weeks</T>
      <T size={11} color={colors.muted} style={{ marginTop: 2 }}>Coursework, friendships, family expectations, sleep and later support. No real student data, audio or original transcript. Worker console: localhost:5173</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 5 }}>
        {store.openCase ? (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/case', params: { id: store.openCase!.id } })}>
            <T size={12} weight="bold" color={colors.teal}>Open shared case</T>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => { void Linking.openURL('http://localhost:5173').catch(() => undefined); }}>
          <T size={12} weight="bold" color={colors.teal}>Worker console</T>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { void store.exitDemo().then(() => router.replace('/')); }}>
          <T size={12} weight="bold" color={colors.navy}>Exit demo</T>
        </Pressable>
      </View>
    </View>
  );
}
