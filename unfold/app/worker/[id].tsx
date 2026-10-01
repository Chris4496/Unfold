import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Back, Button, Card, Field, Screen, T } from '../../src/components/ui';
import { formatDay } from '../../src/lib/dates';
import { useStore } from '../../src/store';
import { colors } from '../../src/theme';

export default function WorkerCaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const item = store.cases.find((entry) => entry.id === id && entry.status !== 'withdrawn');
  const [text, setText] = useState('');
  const messages = item ? store.messagesFor(item.id) : [];

  if (!item) {
    return (
      <Screen scroll>
        <Back label="Queue" href="/worker" />
        <T weight="bold" size={22}>This summary is no longer shared.</T>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      keyboard
      footer={
        <Button
          label="Send reply"
          onPress={() => {
            store.sendMessage(item.id, 'worker', text);
            setText('');
          }}
          disabled={text.trim().length === 0}
        />
      }
    >
      <Back label="Queue" href="/worker" />
      <T size={14} weight="semibold" color={colors.teal}>De-identified summary only</T>
      <T weight="extrabold" size={28} style={{ marginTop: 8 }}>{item.summary.mainConcerns}</T>
      <T size={16} color={colors.muted} style={{ marginTop: 8, marginBottom: 16 }}>{item.summary.recentChange}</T>
      <Card title={item.summary.period}>
        {item.summary.excerpts.map((excerpt) => (
          <T key={excerpt.id} size={14} color={colors.muted} style={{ marginBottom: 8 }}>
            {`${formatDay(excerpt.createdAt)}: ${excerpt.text}`}
          </T>
        ))}
        <T size={13} color={colors.faint}>
          Identifiers were removed on the student&apos;s phone. The original audio is not in this queue.
        </T>
      </Card>
      {item.summary.tokens.length > 0 ? (
        <Card title="Removed before sharing">
          <T size={15} color={colors.muted}>{item.summary.tokens.map((token) => `[${token}]`).join(' ')}</T>
        </Card>
      ) : null}
      {messages.map((message) => (
        <Card key={message.id} title={message.from === 'worker' ? 'Your reply' : 'Student'}>
          <T size={15}>{message.text}</T>
        </Card>
      ))}
      <Card title="A short reply">
        <Field value={text} onChangeText={setText} placeholder="Write in your own words" multiline />
      </Card>
    </Screen>
  );
}
