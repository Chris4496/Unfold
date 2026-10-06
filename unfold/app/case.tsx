import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { StudentNav } from '../src/components/studentNav';
import { Back, Button, ButtonRow, Field, Notice, Screen, T } from '../src/components/ui';
import { dayKey, formatDay, formatTime } from '../src/lib/dates';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

const REFRESH_MS = 15000;

/**
 * Two-step inline confirmation (Alert.alert is a no-op on web, so the
 * confirm is built from regular components like the other delete flows).
 */
function WithdrawButton({ onWithdraw }: { onWithdraw: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <View style={{ gap: 10 }}>
        <T weight="bold">
          Withdraw sharing? The social worker will no longer see your summary or messages. This cannot be undone.
        </T>
        <ButtonRow>
          <Button label="Cancel" tone="secondary" onPress={() => setConfirming(false)} />
          <Button label="Withdraw" onPress={onWithdraw} />
        </ButtonRow>
      </View>
    );
  }
  return <Button label="Withdraw sharing" tone="secondary" onPress={() => setConfirming(true)} />;
}

/** 0 → 1 once on mount, for entrance transitions. */
function useEnter(delay = 0, onDone?: () => void) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 280,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => { if (finished) onDone?.(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);
  return progress;
}

function RiseIn({ delay, children }: { delay?: number; children: ReactNode }) {
  const progress = useEnter(delay);
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** The nav bar sliding away as the chat opens; it sits over the footer so nothing shifts when it goes. */
function NavExit({ onDone }: { onDone: () => void }) {
  const progress = useEnter(0, onDone);
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 80] }) }],
      }}
    >
      <StudentNav active="shared" />
    </Animated.View>
  );
}

function DayDivider({ iso }: { iso: string }) {
  return (
    <View style={{ alignItems: 'center', marginVertical: 6 }}>
      <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.pill }}>
        <T size={12} weight="semibold" color={colors.muted}>{formatDay(iso)}</T>
      </View>
    </View>
  );
}

function Bubble({
  mine,
  sender,
  time,
  soft = false,
  children,
}: {
  mine: boolean;
  /** Shown above the bubble when the speaker changes. */
  sender?: string;
  time: string;
  /** Tinted instead of solid, for the summary that opens the thread. */
  soft?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
      {sender ? (
        <T size={12} weight="semibold" color={colors.muted} style={{ marginBottom: 4, marginHorizontal: 6 }}>
          {sender}
        </T>
      ) : null}
      <View
        style={{
          maxWidth: '86%',
          paddingHorizontal: 16,
          paddingVertical: 11,
          borderRadius: 22,
          borderBottomRightRadius: mine ? 6 : 22,
          borderBottomLeftRadius: mine ? 22 : 6,
          borderWidth: 1,
          borderColor: mine ? (soft ? colors.mintDeep : colors.teal) : colors.line,
          backgroundColor: mine ? (soft ? colors.tealSoft : colors.teal) : colors.card,
        }}
      >
        {children}
      </View>
      <T size={11} color={colors.faint} style={{ marginTop: 4, marginHorizontal: 6 }}>{time}</T>
    </View>
  );
}

function Composer({ value, onChangeText, onSend }: { value: string; onChangeText: (value: string) => void; onSend: () => void }) {
  const empty = value.trim().length === 0;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        paddingLeft: 18,
        paddingRight: 6,
        paddingVertical: 6,
        borderRadius: 26,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.card,
        boxShadow: '0 6px 20px rgba(23, 48, 71, 0.08)',
      }}
    >
      <View style={{ flex: 1, justifyContent: 'center', minHeight: 40, paddingVertical: 9 }}>
        <Field value={value} onChangeText={onChangeText} placeholder="Write a message" accessibilityLabel="Message" multiline compact />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send"
        disabled={empty}
        onPress={onSend}
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 20,
          backgroundColor: colors.teal,
          opacity: empty ? 0.4 : pressed ? 0.85 : 1,
        })}
      >
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M12 19V5M6 11l6-6 6 6" stroke={colors.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
    </View>
  );
}

export default function CaseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const store = useStore();
  const item = store.cases.find((entry) => entry.id === id) ?? store.openCase;
  const [text, setText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [navGone, setNavGone] = useState(false);
  const messages = item ? store.messagesFor(item.id) : [];
  const remote = Boolean(item?.remote && store.deviceToken && (store.cloudOrg || store.isDemo));

  // Live status/messages from the server while a remote case is open.
  useEffect(() => {
    if (!remote || !item || item.status === 'withdrawn') return;
    void store.refreshCaseFromServer();
    const timer = setInterval(() => void store.refreshCaseFromServer(), REFRESH_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, item?.id, item?.status]);

  useEffect(() => {
    if (item && !item.seenReply) store.markReplySeen(item.id);
  }, [item, store]);

  if (!store.ready) return <Screen footer={<StudentNav active="shared" />}><View /></Screen>;
  if (!store.onboarded) return <Redirect href="/onboarding" />;

  if (!item || item.status === 'withdrawn') {
    return (
      <Screen scroll footer={<StudentNav active="shared" />}>
        <Back label="Home" href="/" />
        <T weight="extrabold" size={30}>Shared summary</T>
        <T size={17} weight="semibold" style={{ marginTop: 16 }}>Nothing is shared right now.</T>
        <T size={16} color={colors.muted} style={{ marginTop: 8 }}>
          You can keep recording privately.
        </T>
      </Screen>
    );
  }

  const waiting = item.status === 'queued' || item.status === 'rematch' || item.status === 'claimed';

  const heading = waiting
    ? item.status === 'claimed'
      ? 'A social worker is reading your summary'
      : 'Waiting for a reply'
    : 'A social worker replied';

  const subline = item.waitingNoWorker
    ? 'No social worker has taken the case yet — keep waiting or withdraw.'
    : item.status === 'rematch'
      ? 'You asked for a different social worker. The summary is back in the queue.'
      : item.status === 'claimed'
        ? 'You will see the reply here. You can still withdraw at any time.'
        : item.status === 'continued'
          ? 'Only the summary you approved is visible.'
          : 'Only the summary you approved is visible. You can withdraw sharing at any time.';

  const composing = item.status === 'continued';
  const canRematch = item.status === 'replied' || item.status === 'continued';

  const send = () => {
    store.sendMessage(item.id, 'student', text);
    setText('');
  };

  return (
    <Screen
      scroll
      keyboard
      footer={
        composing || !navGone ? (
          <View pointerEvents="box-none">
            {composing ? (
              <RiseIn delay={120}>
                <Composer value={text} onChangeText={setText} onSend={send} />
              </RiseIn>
            ) : null}
            {navGone ? null : <NavExit onDone={() => setNavGone(true)} />}
          </View>
        ) : undefined
      }
    >
      <Back label="Home" href="/" />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, zIndex: 1 }}>
        <T weight="extrabold" size={30} style={{ flex: 1 }}>Shared summary</T>
        {canRematch ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More options"
            accessibilityState={{ expanded: menuOpen }}
            onPress={() => setMenuOpen((open) => !open)}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 20,
              backgroundColor: menuOpen || pressed ? colors.pill : 'transparent',
            })}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill={colors.muted}>
              <Circle cx="5" cy="12" r="1.8" />
              <Circle cx="12" cy="12" r="1.8" />
              <Circle cx="19" cy="12" r="1.8" />
            </Svg>
          </Pressable>
        ) : null}
        {canRematch && menuOpen ? (
          <View
            style={{
              position: 'absolute',
              top: 46,
              right: 0,
              padding: 6,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.card,
              boxShadow: '0 10px 30px rgba(23, 48, 71, 0.14)',
            }}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => { setMenuOpen(false); store.rematchCase(item.id); }}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: pressed ? colors.pill : 'transparent',
              })}
            >
              <T weight="semibold" size={15}>Ask for someone else</T>
            </Pressable>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: waiting ? colors.peachDeep : colors.teal }} />
        <T weight="bold" size={15} style={{ flex: 1 }}>{heading}</T>
      </View>
      <T size={14} color={colors.muted} style={{ marginTop: 6, marginBottom: 16 }}>
        {subline}
      </T>
      {!remote ? (
        <View style={{ marginBottom: 12 }}>
          <Notice
            title="Demo mode"
            body="This summary is stored on this phone only. Messages here are a local simulation — no real social worker will reply."
          />
        </View>
      ) : null}
      <View style={{ gap: 10 }}>
        <DayDivider iso={item.createdAt} />
        <RiseIn>
          <Bubble mine soft time={formatTime(item.createdAt)}>
            <T size={11} weight="bold" color={colors.tealDark} style={{ letterSpacing: 0.6, marginBottom: 4 }}>
              WHAT YOU SHARED
            </T>
            <T weight="bold" size={15}>{item.summary.mainConcerns}</T>
            <T size={15} color={colors.muted} style={{ marginTop: 6 }}>{item.summary.recentChange}</T>
          </Bubble>
        </RiseIn>
        {messages.map((message, index) => {
          const mine = message.from === 'student';
          const previous = messages[index - 1];
          const newDay = dayKey(message.createdAt) !== dayKey(previous?.createdAt ?? item.createdAt);
          // The summary bubble is the student's, so the first worker message always gets a name.
          const speakerChanged = (previous?.from ?? 'student') !== message.from;
          const sender = !mine && (speakerChanged || newDay)
            ? message.workerName ? `${message.workerName} · Social worker` : 'Social worker'
            : undefined;
          return (
            <RiseIn key={message.id} delay={Math.min(index + 1, 6) * 50}>
              <View style={{ gap: 10 }}>
                {newDay ? <DayDivider iso={message.createdAt} /> : null}
                <Bubble mine={mine} sender={sender} time={formatTime(message.createdAt)}>
                  <T size={15} color={mine ? colors.white : colors.navy}>{message.text}</T>
                </Bubble>
              </View>
            </RiseIn>
          );
        })}
      </View>
      <View style={{ gap: 10, marginTop: 20 }}>
        {waiting ? <WithdrawButton onWithdraw={() => store.withdrawCase(item.id)} /> : null}
        {item.status === 'replied' ? (
          <>
            <Button label="Continue the conversation" onPress={() => store.continueCase(item.id)} />
            <WithdrawButton onWithdraw={() => store.withdrawCase(item.id)} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}
