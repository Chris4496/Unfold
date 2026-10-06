import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

export type StudentNavTab = 'record' | 'dashboard' | 'diary' | 'ask' | 'shared';

const TABS: { id: StudentNavTab; label: string; route: '/' | '/dashboard' | '/diary' | '/ask' | '/case' }[] = [
  { id: 'dashboard', label: 'Dashboard', route: '/dashboard' },
  { id: 'diary', label: 'Diary', route: '/diary' },
  { id: 'record', label: 'Record', route: '/' },
  { id: 'ask', label: 'Ask', route: '/ask' },
  { id: 'shared', label: 'Shared', route: '/case' },
];

function TabIcon({ id, color, size = 24 }: { id: StudentNavTab; color: string; size?: number }) {
  const stroke = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {id === 'record' ? (
        <>
          <Rect x="9" y="3" width="6" height="11" rx="3" {...stroke} />
          <Path d="M6.5 11.5a5.5 5.5 0 0 0 11 0" {...stroke} />
          <Path d="M12 17v3.5" {...stroke} />
        </>
      ) : null}
      {id === 'dashboard' ? (
        <>
          <Rect x="4.5" y="4.5" width="6.5" height="6.5" rx="1.5" {...stroke} />
          <Rect x="13" y="4.5" width="6.5" height="6.5" rx="1.5" {...stroke} />
          <Rect x="4.5" y="13" width="6.5" height="6.5" rx="1.5" {...stroke} />
          <Rect x="13" y="13" width="6.5" height="6.5" rx="1.5" {...stroke} />
        </>
      ) : null}
      {id === 'diary' ? (
        <>
          <Path d="M6 4h10a2 2 0 0 1 2 2v14H7.5A1.5 1.5 0 0 1 6 18.5V4Z" {...stroke} />
          <Path d="M6 18.5A1.5 1.5 0 0 1 7.5 17H18" {...stroke} />
          <Path d="M10 8.5h4" {...stroke} />
        </>
      ) : null}
      {id === 'ask' ? (
        <Path
          d="M7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-3.5 3.5V16A2.5 2.5 0 0 1 5 13.5v-7A2.5 2.5 0 0 1 7.5 4Z"
          {...stroke}
        />
      ) : null}
      {id === 'shared' ? (
        <>
          <Circle cx="9" cy="8.5" r="3" {...stroke} />
          <Path d="M3.5 19a5.5 5.5 0 0 1 11 0" {...stroke} />
          <Path d="M15.5 5.8a3 3 0 0 1 0 5.4" {...stroke} />
          <Path d="M17 14.2a5.5 5.5 0 0 1 3.5 4.8" {...stroke} />
        </>
      ) : null}
    </Svg>
  );
}

export function StudentNav({ active }: { active: StudentNavTab }) {
  const router = useRouter();
  return (
    <View
      accessibilityLabel="Student navigation"
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
        // Matches the vertical inset so the end circles sit concentric with the bar's rounded caps.
        paddingHorizontal: 8,
        borderRadius: 30,
        boxShadow: '0 10px 30px rgba(23, 48, 71, 0.14)',
      }}
    >
      <BlurView
        intensity={36}
        tint="light"
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            overflow: 'hidden',
            borderRadius: 30,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.75)',
            backgroundColor: 'rgba(255, 255, 255, 0.28)',
          },
        ]}
      />
      {TABS.map((tab) => {
        const selected = active === tab.id;
        const record = tab.id === 'record';
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => router.replace(tab.route)}
            style={({ pressed }) => ({
              width: record ? 72 : 44,
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            {record ? (
              <View
                style={{
                  width: 72,
                  height: 72,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 36,
                  borderWidth: 4,
                  borderColor: 'rgba(255, 255, 255, 0.8)',
                  backgroundColor: selected ? colors.tealDark : colors.teal,
                  transform: [{ translateY: -6 }],
                }}
              >
                <TabIcon id={tab.id} color={colors.white} size={32} />
              </View>
            ) : (
              <View
                style={{
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 22,
                  backgroundColor: selected ? 'rgba(27, 122, 104, 0.16)' : 'transparent',
                }}
              >
                <TabIcon id={tab.id} color={selected ? colors.tealDark : colors.muted} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
