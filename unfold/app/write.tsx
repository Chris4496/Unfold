import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Back, Button, Card, Field, Screen, T } from '../src/components/ui';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

export default function WriteScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [text, setText] = useState('');
  const store = useStore();
  const router = useRouter();

  function save() {
    const entry = store.addEntry(text);
    if (!entry) return;
    router.replace({ pathname: '/saved', params: { id: entry.id } });
  }

  return (
    <Screen
      keyboard
      scroll
      footer={<Button label="Save on this phone" onPress={save} disabled={text.trim().length === 0} />}
    >
      <Back label="Home" href="/" />
      <T size={14} weight="semibold" color={colors.teal}>
        Step 1 · Record
      </T>
      <T weight="extrabold" size={30} style={{ marginTop: 8 }}>
        What did you want to say?
      </T>
      <T size={16} color={colors.muted} style={{ marginTop: 8, marginBottom: 18 }}>
        {reason === 'mic'
          ? 'The microphone is not available. Type it instead. It still stays on this phone.'
          : 'Type it here. It stays on this phone, just like a recording.'}
      </T>
      <Card title="Your note">
        <Field value={text} onChangeText={setText} placeholder="Start writing…" multiline />
      </Card>
      <View />
    </Screen>
  );
}
