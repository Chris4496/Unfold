import { useRouter } from 'expo-router';
import { Children, createContext, useContext, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { CheckIcon, LockIcon } from './art';

export type AppFonts = {
  medium?: string;
  semibold?: string;
  bold?: string;
  extrabold?: string;
};

const FontContext = createContext<AppFonts>({});

export function FontProvider({ fonts, children }: { fonts: AppFonts; children: ReactNode }) {
  return <FontContext.Provider value={fonts}>{children}</FontContext.Provider>;
}

type Weight = keyof AppFonts;

export function T({
  children,
  size = 16,
  weight = 'medium',
  color = colors.navy,
  center,
  style,
}: {
  children: ReactNode;
  size?: number;
  weight?: Weight;
  color?: string;
  center?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const fonts = useContext(FontContext);
  return (
    <Text
      style={[
        {
          fontFamily: fonts[weight],
          fontSize: size,
          color,
          lineHeight: Math.round(size * 1.4),
          textAlign: center ? 'center' : 'left',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Screen({
  children,
  footer,
  scroll,
  keyboard,
  decor = false,
}: {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  keyboard?: boolean;
  decor?: boolean;
}) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={styles.fill}>{children}</View>
  );

  const frame = (
    <SafeAreaView style={styles.frame} edges={['top', 'bottom']}>
      {decor ? <View pointerEvents="none" style={styles.waveTop} /> : null}
      {decor ? <View pointerEvents="none" style={styles.sun} /> : null}
      {decor ? <View pointerEvents="none" style={styles.waveBottom} /> : null}
      {body}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );

  return (
    <View style={styles.canvas}>
      <View pointerEvents="none" style={styles.blobMint} />
      <View pointerEvents="none" style={styles.blobPeach} />
      <View pointerEvents="none" style={styles.blobDeep} />
      {keyboard ? (
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {frame}
        </KeyboardAvoidingView>
      ) : (
        frame
      )}
    </View>
  );
}

export function Back({ label = 'Back', href }: { label?: string; href?: '/' | '/diary' | '/worker' | '/privacy' }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={12}
      onPress={() => {
        if (href) router.replace(href);
        else if (router.canGoBack()) router.back();
        else router.replace('/');
      }}
      style={styles.back}
    >
      <T weight="semibold" size={15} color={colors.teal}>
        {`‹  ${label}`}
      </T>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  const primary = tone === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.secondary,
        (disabled || pressed) && { opacity: disabled ? 0.45 : 0.88 },
      ]}
    >
      <T weight="bold" size={16} color={primary ? colors.white : colors.navy} center>
        {label}
      </T>
    </Pressable>
  );
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return (
    <View style={styles.row}>
      {Children.map(children, (child, index) => (
        <View key={index} style={{ flex: index === 0 ? 0.9 : 1.15 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <T weight="bold" size={17}>
        {title}
      </T>
      <View style={{ marginTop: 6 }}>{children}</View>
    </View>
  );
}

export function Stepper({ current, done = false }: { current: 1 | 2 | 3; done?: boolean }) {
  const complete = [done || current > 1, done || current > 2, done];
  const labels = ['Recorded', 'Protected', 'Review'];
  return (
    <View style={styles.stepper}>
      <View style={styles.stepTrack}>
        {complete.map((isComplete, index) => (
          <View key={labels[index]} style={styles.stepItem}>
            <View style={[styles.dot, isComplete ? styles.dotDone : styles.dotOpen]}>
              {isComplete ? <CheckIcon /> : null}
            </View>
            {index < complete.length - 1 ? (
              <View style={[styles.stepLine, complete[index + 1] ? styles.lineDone : styles.lineOpen]} />
            ) : null}
            <T
              size={12}
              weight="semibold"
              color={index === current - 1 && !done ? colors.navy : colors.faint}
              center
              style={styles.stepLabel}
            >
              {labels[index]}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}

export function LockPill({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Only on your phone" onPress={onPress} style={styles.pill}>
      <LockIcon />
      <T size={14} weight="semibold" color={colors.muted}>
        Only on your phone
      </T>
    </Pressable>
  );
}

export function Notice({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <View style={styles.notice}>
      <T weight="bold" size={15}>
        {title}
      </T>
      <T size={14} color={colors.muted} style={{ marginTop: 4 }}>
        {body}
      </T>
      {children ? <View style={{ marginTop: 12 }}>{children}</View> : null}
    </View>
  );
}

export function Field({
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const fonts = useContext(FontContext);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      multiline={multiline}
      textAlignVertical="top"
      style={{
        fontFamily: fonts.medium,
        fontSize: 16,
        color: colors.navy,
        lineHeight: 22,
        minHeight: multiline ? 140 : 44,
        padding: 0,
      }}
    />
  );
}

export function TokenRow({ tokens, empty }: { tokens: string[]; empty: string }) {
  if (tokens.length === 0) {
    return (
      <T size={15} color={colors.muted}>
        {empty}
      </T>
    );
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 }}>
      {tokens.map((token) => (
        <T key={token} size={15} color={colors.muted}>{`[${token}]`}</T>
      ))}
    </View>
  );
}

export function QuietButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={{ paddingVertical: 6 }}>
      <T weight="semibold" size={15} color={colors.teal} center>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  fill: { flex: 1 },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: colors.screen,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 0,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    flexGrow: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 18,
    gap: 10,
  },
  blobMint: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#D5EBE3',
    top: 40,
    left: -40,
  },
  blobPeach: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#F6D9CC',
    top: 120,
    right: -30,
  },
  blobDeep: {
    position: 'absolute',
    width: 260,
    height: 200,
    borderRadius: 120,
    backgroundColor: '#2C5C6E',
    bottom: -60,
    right: -20,
  },
  waveTop: {
    position: 'absolute',
    top: -36,
    left: -50,
    width: 280,
    height: 120,
    borderRadius: 80,
    backgroundColor: '#E5F3EE',
    transform: [{ rotate: '-8deg' }],
  },
  sun: {
    position: 'absolute',
    top: 72,
    right: 22,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F8DCCF',
  },
  waveBottom: {
    position: 'absolute',
    bottom: -20,
    left: -40,
    right: -40,
    height: 110,
    borderRadius: 80,
    backgroundColor: '#E7F4F0',
  },
  back: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  button: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    width: '100%',
  },
  primary: { backgroundColor: colors.teal },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: '#D5E3DE',
  },
  row: { flexDirection: 'row', gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  stepper: { marginTop: 12, marginBottom: 4 },
  stepTrack: { flexDirection: 'row', justifyContent: 'center' },
  stepItem: { width: 108, alignItems: 'center' },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.teal },
  dotOpen: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.teal },
  stepLine: { position: 'absolute', top: 13, left: 68, width: 80, height: 3, borderRadius: 2 },
  lineDone: { backgroundColor: colors.teal },
  lineOpen: { backgroundColor: '#D9E4E0' },
  stepLabel: { marginTop: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.pill,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  notice: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  },
});
