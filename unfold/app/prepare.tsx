import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Button, Screen, Stepper, T } from '../src/components/ui';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

const LINES = [
  'Recordings are already saved on this phone.',
  'Names, schools and addresses are removed here, before you review anything.',
  'You will see the short summary and can still decide not to share it.',
];

export default function PrepareScreen() {
  const store = useStore();
  const router = useRouter();
  const prepared = useRef(false);

  useEffect(() => {
    if (prepared.current) return;
    prepared.current = true;
    store.prepareDraft();
  }, [store]);

  return (
    <Screen footer={<Button label="Review summary" onPress={() => router.push('/review')} disabled={store.entries.length === 0} />}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
        <Stepper current={2} />
        <T weight="extrabold" size={30} center style={{ marginTop: 24 }}>
          Protecting your note
        </T>
        <T size={16} color={colors.muted} center style={{ marginTop: 8, marginBottom: 20 }}>
          This step happens on your phone.
        </T>
        {LINES.map((line, index) => (
          <View key={line} style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: index === 0 ? colors.teal : colors.tealSoft, alignItems: 'center', justifyContent: 'center' }}>
              <T size={13} weight="bold" color={index === 0 ? colors.white : colors.teal}>{index + 1}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T size={15}>{line}</T>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}
