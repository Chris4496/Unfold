import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Back, Button, Card, Field, Notice, Screen, T } from '../src/components/ui';
import { formatDay } from '../src/lib/dates';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

const REFRESH_MS = 15000;

export default function CaseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const store = useStore();
  const item = store.cases.find((entry) => entry.id === id) ?? store.openCase;
  const [text, setText] = useState('');
  const messages = item ? store.messagesFor(item.id) : [];
  const remote = Boolean(item?.remote && store.cloudOrg && store.deviceToken);

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

  if (!item || item.status === 'withdrawn') {
    return (
      <Screen scroll>
        <Back label="Home" href="/" />
        <T weight="extrabold" size={30}>Nothing is shared right now.</T>
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
        : 'Only the summary you approved is visible. You can withdraw sharing at any time.';

  return (
    <Screen
      scroll
      keyboard
      footer={
        item.status === 'continued' ? (
          <Button label="Send" onPress={() => { store.sendMessage(item.id, 'student', text); setText(''); }} disabled={text.trim().length === 0} />
        ) : null
      }
    >
      <Back label="Home" href="/" />
      <T size={14} weight="semibold" color={colors.teal}>Your choice</T>
      <T weight="extrabold" size={30} style={{ marginTop: 8 }}>
        {heading}
      </T>
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
        <Card key={message.id} title={message.from === 'worker' ? 'Social worker' : 'You'}>
          <T size={15}>{message.text}</T>
          <T size={12} color={colors.faint} style={{ marginTop: 6 }}>{formatDay(message.createdAt)}</T>
        </Card>
      ))}
      {waiting ? <Button label="Withdraw sharing" tone="secondary" onPress={() => store.withdrawCase(item.id)} /> : null}
      {item.status === 'replied' ? (
        <View style={{ gap: 10 }}>
          <Button label="Continue the conversation" onPress={() => store.continueCase(item.id)} />
          <Button label="Ask for someone else" tone="secondary" onPress={() => store.rematchCase(item.id)} />
          <Button label="Withdraw sharing" tone="secondary" onPress={() => store.withdrawCase(item.id)} />
        </View>
      ) : null}
      {item.status === 'continued' ? (
        <View style={{ gap: 12 }}>
          <Card title="Write a message">
            <Field value={text} onChangeText={setText} placeholder="Your reply" multiline />
          </Card>
          <Button label="Ask for someone else" tone="secondary" onPress={() => store.rematchCase(item.id)} />
          <Button label="Withdraw sharing" tone="secondary" onPress={() => store.withdrawCase(item.id)} />
        </View>
      ) : null}
    </Screen>
  );
}
