import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { T } from './ui';
import { colors } from '../theme';

export type StudentNavTab = 'record' | 'dashboard' | 'diary' | 'ask' | 'shared';

const TABS: { id: StudentNavTab; label: string; route: '/' | '/dashboard' | '/diary' | '/ask' | '/case' }[] = [
  { id: 'record', label: 'Record', route: '/' },
  { id: 'dashboard', label: 'Dashboard', route: '/dashboard' },
  { id: 'diary', label: 'Diary', route: '/diary' },
  { id: 'ask', label: 'Ask', route: '/ask' },
  { id: 'shared', label: 'Shared', route: '/case' },
];

export function StudentNav({ active }: { active: StudentNavTab }) {
  const router = useRouter();
  return (
    <View
      accessibilityLabel="Student navigation"
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 4,
        padding: 5,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      {TABS.map((tab) => {
        const selected = active === tab.id;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => router.replace(tab.route)}
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              backgroundColor: selected ? colors.tealSoft : 'transparent',
            }}
          >
            <T size={13} weight={selected ? 'bold' : 'semibold'} color={selected ? colors.tealDark : colors.muted} center>
              {tab.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
