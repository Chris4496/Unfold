import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { StudentNav } from '../src/components/studentNav';
import { askWithFallback, type AskOutcome } from '../src/api';
import { Back, Button, Card, Field, Screen, T } from '../src/components/ui';
import { dayKey } from '../src/lib/dates';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

const SUGGESTIONS = ['What did I say about sleep?', 'When did I mention coursework?'];

function sourceLabel(outcome: AskOutcome): string {
  if (outcome.source === 'cloud') {
    return outcome.genai ? 'Cloud answer (AI)' : 'Cloud answer (server rules — not AI)';
  }
  return 'On-device search';
}

export default function AskScreen() {
  const store = useStore();
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AskOutcome | null>(null);
  const [asking, setAsking] = useState(false);

  async function ask(text = question) {
    if (asking) return;
    setQuestion(text);
    setAsking(true);
    try {
      const outcome = await askWithFallback(store.cloudOrg ? store.deviceToken : null, text, store.entries);
      setAnswer(outcome);
    } finally {
      setAsking(false);
    }
  }

  return (
    <Screen
      keyboard
      scroll
      footer={(
        <View style={{ gap: 20 }}>
          <Button label={asking ? 'Asking…' : 'Ask'} onPress={() => void ask()} disabled={asking || question.trim().length === 0} />
          <StudentNav active="ask" />
        </View>
      )}
    >
      <Back label="Home" href="/" />
      <T weight="extrabold" size={30}>
        Ask your diary
      </T>
      <T size={16} color={colors.muted} style={{ marginTop: 8, marginBottom: 16 }}>
        {store.cloudOrg
          ? 'Questions search the de-identified notes on the server. If it is unreachable, the notes on this phone are searched instead.'
          : 'Questions search the notes on this phone. Answers quote what you recorded, with the date.'}
      </T>
      <Card title="Your question">
        <Field value={question} onChangeText={setQuestion} placeholder="What did I mention last week?" />
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {SUGGESTIONS.map((suggestion) => (
          <Pressable
            key={suggestion}
            accessibilityRole="button"
            onPress={() => void ask(suggestion)}
            style={{ backgroundColor: colors.pill, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}
          >
            <T size={13} weight="semibold">{suggestion}</T>
          </Pressable>
        ))}
      </View>
      {answer ? (
        <Card title={answer.found ? 'From your notes' : 'Nothing matched'}>
          <T size={12} weight="semibold" color={colors.faint}>{sourceLabel(answer)}</T>
          <T size={15} style={{ marginTop: 6 }}>{answer.text}</T>
          {answer.hits.map((hit) =>
            hit.createdAt ? (
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
            ) : null,
          )}
        </Card>
      ) : null}
    </Screen>
  );
}
