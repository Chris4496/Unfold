import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Back, Button, Card, Field, Screen, T } from '../src/components/ui';
import { formatDay } from '../src/lib/dates';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

export default function CaseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const store = useStore();
  const item = store.cases.find((entry) => entry.id === id) ?? store.openCase;
  const [text, setText] = useState('');
  const messages = item ? store.messagesFor(item.id) : [];

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

  const waiting = item.status === 'queued' || item.status === 'rematch';

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
        {waiting ? 'Waiting for a reply' : 'A social worker replied'}
      </T>
      <T size={15} color={colors.muted} style={{ marginTop: 8, marginBottom: 16 }}>
        {item.status === 'rematch'
          ? 'You asked for a different social worker. The summary is back in the queue.'
          : 'Only the summary you approved is visible. You can withdraw sharing at any time.'}
      </T>
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
          <Button label="Withdraw sharing" tone="secondary" onPress={() => store.withdrawCase(item.id)} />
        </View>
      ) : null}
    </Screen>
  );
}
