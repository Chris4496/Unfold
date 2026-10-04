import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Back, QuietButton, Screen, T } from '../src/components/ui';
import { colors } from '../src/theme';

const STEPS = [
  {
    title: 'On this phone',
    body: 'Recordings are sent to ElevenLabs only to be transcribed. Recordings and full transcripts are saved here. You can delete a note from the diary.',
  },
  {
    title: 'De-identified here, before anything leaves',
    body: 'Names, schools, addresses, phone numbers and email addresses — in English and common Chinese forms — are replaced on this phone with markers like [PERSON] or [ADDRESS] before a summary is shown or sent. This filter is best-effort: uncommon names or unusual spellings can be missed, and ordinary words that look like names are deliberately left alone. Read a summary before approving it.',
  },
  {
    title: 'Optional cloud organisation',
    body: 'If you turn on cloud organisation in Settings, only the de-identified text of your notes goes to the Unfold server for themes, daily summaries and Ask your diary — never transcripts or audio. Turning it off deletes every cloud copy from the server; deleting a note or everything on this phone deletes the matching cloud copies too.',
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
