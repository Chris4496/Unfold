import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

export function MicIcon({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="3" width="6" height="11" rx="3" fill="#FFFFFF" />
      <Path d="M7 11.5a5 5 0 0 0 10 0" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M12 16.5V20" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M9 20h6" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function LockIcon({ color = colors.teal, size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="5" y="10" width="14" height="10" rx="2.2" fill={color} />
      <Path d="M8 10V8a4 4 0 0 1 8 0v2" stroke={color} strokeWidth="1.8" />
      <Path d="M12 14.2v2.2" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function CheckIcon({ color = '#FFFFFF', size = 14 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.5 10 17.5 19 7.5" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CalendarIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="5" width="16" height="15" rx="2" stroke={colors.teal} strokeWidth="1.7" />
      <Path d="M8 3.5v3M16 3.5v3M4 9.5h16" stroke={colors.teal} strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function SearchIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" stroke={colors.teal} strokeWidth="1.7" />
      <Path d="M16.2 16.2 20 20" stroke={colors.teal} strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

function Bar({ active, base, delay }: { active: boolean; base: number; delay: number }) {
  const height = useRef(new Animated.Value(base)).current;

  useEffect(() => {
    if (!active) {
      height.setValue(base);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(height, { toValue: base + 16, duration: 380 + delay, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(height, { toValue: Math.max(6, base - 6), duration: 380 + delay, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, base, delay, height]);

  return (
    <Animated.View
      style={{
        width: 3,
        height,
        borderRadius: 3,
        marginHorizontal: 2.5,
        backgroundColor: active ? '#7FB3A6' : '#C5DDD6',
      }}
    />
  );
}

export function Waveform({ active }: { active: boolean }) {
  const bars = [8, 14, 22, 14, 9];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', width: 52, justifyContent: 'center' }}>
      {bars.map((base, index) => (
        <Bar key={index} active={active} base={base} delay={index * 70} />
      ))}
    </View>
  );
}

export function RecordButton({ recording, onPress }: { recording: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!recording) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, scale]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <Waveform active={recording} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Stop recording' : 'Tap to record'}
        onPress={onPress}
      >
        <Animated.View
          style={{
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: 'rgba(27, 122, 104, 0.10)',
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale }],
          }}
        >
          <View
            style={{
              width: 116,
              height: 116,
              borderRadius: 58,
              backgroundColor: recording ? colors.tealDark : colors.teal,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {recording ? (
              <View style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: '#FFFFFF' }} />
            ) : (
              <MicIcon />
            )}
          </View>
        </Animated.View>
      </Pressable>
      <Waveform active={recording} />
    </View>
  );
}

export function TimelineArt() {
  return (
    <Svg width={148} height={96} viewBox="0 0 148 96" accessibilityLabel="Decorative notebook and leaves">
      <Path d="M12 76c22-16 44-20 65-8 18-16 37-18 58-8" fill="none" stroke="#C5DDD4" strokeWidth={4} strokeLinecap="round" />
      <Rect x={48} y={22} width={52} height={58} rx={7} fill="#FFFFFF" stroke="#D9E8E2" strokeWidth={2} transform="rotate(-7 74 51)" />
      <Path d="M58 39h29M57 49h30M56 59h24" stroke="#AFC9C0" strokeWidth={3} strokeLinecap="round" />
      <Path d="M112 71c-9-15-5-29 7-38 2 14 0 27-7 38Zm-3-13c-14-5-20-15-19-27 12 6 19 15 19 27Z" fill="#77B2A2" />
      <Circle cx={30} cy={26} r={9} fill="#F6D7C8" />
      <Path d="M30 9v-5M14 15l-4-4M46 15l4-4" stroke="#F0B89A" strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

export function SummaryArt() {
  return (
    <View style={{ height: 176, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: 168,
          height: 132,
          borderRadius: 80,
          backgroundColor: '#DCEEE7',
        }}
      />
      <View
        style={{
          width: 104,
          height: 124,
          borderRadius: 16,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E6EFEC',
          paddingTop: 26,
          paddingHorizontal: 18,
          transform: [{ rotate: '-6deg' }],
          shadowColor: '#173047',
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        <View style={{ height: 8, borderRadius: 4, backgroundColor: '#D9E4EA', marginBottom: 10 }} />
        <View style={{ height: 8, width: '78%', borderRadius: 4, backgroundColor: '#D9E4EA', marginBottom: 10 }} />
        <View style={{ height: 8, borderRadius: 4, backgroundColor: '#D9E4EA' }} />
      </View>
      <View
        style={{
          position: 'absolute',
          right: 92,
          bottom: 28,
          width: 46,
          height: 46,
          borderRadius: 14,
          backgroundColor: colors.teal,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LockIcon color="#FFFFFF" size={20} />
      </View>
      <View style={{ position: 'absolute', right: 58, top: 42 }}>
        <View style={{ width: 18, height: 4, borderRadius: 2, backgroundColor: colors.peachDeep, transform: [{ rotate: '32deg' }], marginBottom: 6 }} />
        <View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: colors.peach, transform: [{ rotate: '32deg' }], marginLeft: 10 }} />
      </View>
    </View>
  );
}
