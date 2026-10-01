import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Back, QuietButton, Screen, T } from '../src/components/ui';
import { colors } from '../src/theme';

const STEPS = [
  {
    title: 'On this phone',
    body: 'Recordings and full transcripts stay here. You can delete a note from the diary.',
  },
  {
    title: 'Prepared here, if you ask',
    body: 'Names, schools, addresses, phone numbers and email addresses are replaced on this phone before a summary is shown.',
  },
  {
    title: 'Shared only if you approve',
    body: 'A social worker can see the short summary and de-identified lines. They cannot hear the audio. You can withdraw later.',
  },
];

export default function PrivacyScreen() {
  const router = useRouter();
  return (
    <Screen scroll>
      <Back label="Home" href="/" />
      <T weight="extrabold" size={30}>Only on your phone</T>
      <T size={16} color={colors.muted} style={{ marginTop: 8, marginBottom: 18 }}>
        Recording and sharing are separate. You can do the first without ever doing the second.
      </T>
      {STEPS.map((step, index) => (
        <View key={step.title} style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' }}>
            <T size={14} weight="bold" color={colors.white}>{index + 1}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T weight="bold">{step.title}</T>
            <T size={15} color={colors.muted} style={{ marginTop: 4 }}>{step.body}</T>
          </View>
        </View>
      ))}
      <T size={14} color={colors.muted}>
        Unfold does not diagnose or provide emergency help. If you need urgent support, contact a trusted person or local emergency services.
      </T>
      <View style={{ alignItems: 'center', marginTop: 12 }}>
        <QuietButton label="Settings" onPress={() => router.push('/settings')} />
      </View>
    </Screen>
  );
}
