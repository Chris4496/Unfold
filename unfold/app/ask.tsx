import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Back, Button, Card, Field, Screen, T } from '../src/components/ui';
import { askEntries, type AskAnswer } from '../src/lib/ask';
import { dayKey } from '../src/lib/dates';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

const SUGGESTIONS = ['What did I say about sleep?', 'When did I mention coursework?'];

export default function AskScreen() {
  const store = useStore();
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AskAnswer | null>(null);

  function ask(text = question) {
    setQuestion(text);
    setAnswer(askEntries(text, store.entries));
  }

  return (
    <Screen keyboard scroll footer={<Button label="Ask" onPress={() => ask()} disabled={question.trim().length === 0} />}>
      <Back label="Home" href="/" />
      <T weight="extrabold" size={30}>
        Ask your diary
      </T>
      <T size={16} color={colors.muted} style={{ marginTop: 8, marginBottom: 16 }}>
        Questions search the notes on this phone. Answers quote what you recorded, with the date.
      </T>
      <Card title="Your question">
        <Field value={question} onChangeText={setQuestion} placeholder="What did I mention last week?" />
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {SUGGESTIONS.map((suggestion) => (
          <Pressable
            key={suggestion}
            accessibilityRole="button"
            onPress={() => ask(suggestion)}
            style={{ backgroundColor: colors.pill, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}
          >
            <T size={13} weight="semibold">{suggestion}</T>
          </Pressable>
        ))}
      </View>
      {answer ? (
        <Card title={answer.found ? 'From your notes' : 'Nothing matched'}>
          <T size={15}>{answer.text}</T>
          {answer.hits.map((hit) => (
            <Pressable
              key={hit.entryId}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/day/[date]', params: { date: dayKey(hit.createdAt) } })}
              style={{ marginTop: 12 }}
            >
              <T size={14} weight="semibold" color={colors.teal}>
                {`Open ${hit.dateLabel}`}
              </T>
            </Pressable>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
