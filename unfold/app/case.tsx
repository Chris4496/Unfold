import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StudentNav } from '../src/components/studentNav';
import { Back, Button, ButtonRow, Card, Field, Notice, Screen, T } from '../src/components/ui';
import { formatDay } from '../src/lib/dates';
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

export default function CaseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const store = useStore();
  const item = store.cases.find((entry) => entry.id === id) ?? store.openCase;
  const [text, setText] = useState('');
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

  return (
    <Screen
      scroll
      keyboard
      footer={
        <View style={{ gap: 10 }}>
          {item.status === 'continued' ? (
            <Button label="Send" onPress={() => { store.sendMessage(item.id, 'student', text); setText(''); }} disabled={text.trim().length === 0} />
          ) : null}
          <StudentNav active="shared" />
        </View>
      }
    >
      <Back label="Home" href="/" />
      <T weight="extrabold" size={30} style={{ marginTop: 8 }}>Shared summary</T>
      <T weight="bold" size={20} style={{ marginTop: 12 }}>{heading}</T>
      <T size={15} color={colors.muted} style={{ marginTop: 8, marginBottom: 16 }}>
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
      <Card title="What you shared">
        <T weight="bold" size={15}>{item.summary.mainConcerns}</T>
        <T size={15} color={colors.muted} style={{ marginTop: 6 }}>{item.summary.recentChange}</T>
      </Card>
      {messages.map((message) => (
        <Card key={message.id} title={message.from === 'worker' ? (message.workerName ? `${message.workerName} (social worker)` : 'Social worker') : 'You'}>
          <T size={15}>{message.text}</T>
          <T size={12} color={colors.faint} style={{ marginTop: 6 }}>{formatDay(message.createdAt)}</T>
        </Card>
      ))}
      {waiting ? <WithdrawButton onWithdraw={() => store.withdrawCase(item.id)} /> : null}
      {item.status === 'replied' ? (
        <View style={{ gap: 10 }}>
          <Button label="Continue the conversation" onPress={() => store.continueCase(item.id)} />
          <Button label="Ask for someone else" tone="secondary" onPress={() => store.rematchCase(item.id)} />
          <WithdrawButton onWithdraw={() => store.withdrawCase(item.id)} />
        </View>
      ) : null}
      {item.status === 'continued' ? (
        <View style={{ gap: 12 }}>
          <Card title="Write a message">
            <Field value={text} onChangeText={setText} placeholder="Your reply" multiline />
          </Card>
          <Button label="Ask for someone else" tone="secondary" onPress={() => store.rematchCase(item.id)} />
        </View>
      ) : null}
    </Screen>
  );
}
