import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { CheckIcon } from '../src/components/art';
import { Button, Screen, Stepper, T } from '../src/components/ui';
import { colors } from '../src/theme';

export default function SharedScreen() {
  const router = useRouter();
  return (
    <Screen
      footer={
        <View style={{ gap: 10 }}>
          <Button label="Open social worker view" onPress={() => router.push('/worker')} />
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
            Your recordings stay on this phone. In this prototype, the next step is to open the social worker view and send a reply.
          </T>
        </View>
      </View>
    </Screen>
  );
}
