import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { CheckIcon } from '../src/components/art';
import { Button, Screen, Stepper, T } from '../src/components/ui';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

export default function SharedScreen() {
  const router = useRouter();
  const store = useStore();
  const openCase = store.openCase;
  return (
    <Screen
      footer={
        <View style={{ gap: 10 }}>
          {openCase ? (
            <Button
              label="See the status"
              onPress={() => router.push({ pathname: '/case', params: { id: openCase.id } })}
            />
          ) : null}
          <Button label="Back to my space" tone="secondary" onPress={() => router.replace('/')} />
        </View>
      }
    >
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 28 }}>
        <Stepper current={3} done />
        <View style={{ alignItems: 'center', marginTop: 36 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' }}>
            <CheckIcon size={28} />
          </View>
          <T weight="extrabold" size={30} center style={{ marginTop: 20 }}>
            Only the summary was shared.
          </T>
          <T size={16} color={colors.muted} center style={{ marginTop: 10 }}>
            {openCase?.remote
              ? 'Your recordings and full transcripts stay on this phone. A verified social worker can now pick up the summary and reply here.'
              : 'Your recordings stay on this phone. Demo mode: the summary is queued on this device only, so no real social worker will reply.'}
          </T>
        </View>
      </View>
    </Screen>
  );
}
