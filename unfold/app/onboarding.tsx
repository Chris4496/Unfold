import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { CheckIcon, LockIcon, MicIcon, SummaryArt } from '../src/components/art';
import { Button, Screen, T } from '../src/components/ui';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

const STEPS = [
  {
    title: 'Say what is on your mind',
    body: 'Tap the big button whenever you want. You do not have to pick a topic or fill in a form.',
  },
  {
    title: 'It stays on your phone',
    body: 'Your recording is sent to ElevenLabs only to turn it into text. The recording and the full transcript are saved on this device. You can delete them whenever you want.',
  },
  {
    title: 'You choose what is shared',
    body: 'If you want a social worker to see a short summary, you review it first. Names, schools and addresses are removed on your phone. Nothing is shared unless you approve.',
  },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState(false);
  const store = useStore();
  const router = useRouter();
  const page = STEPS[step];

  function next() {
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    store.completeOnboarding();
    router.replace('/');
  }

  return (
    <Screen
      footer={
        <Button label={step === 2 ? 'Start' : 'Next'} onPress={next} disabled={step === 2 && !checked} />
      }
    >
      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}>
        <T size={14} weight="semibold" color={colors.teal} center>
          {`Step ${step + 1} of 3`}
        </T>
        <View style={{ height: 176, alignItems: 'center', justifyContent: 'center' }}>
          {step === 0 ? (
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' }}>
              <MicIcon />
            </View>
          ) : null}
          {step === 1 ? (
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' }}>
              <LockIcon size={36} />
            </View>
          ) : null}
          {step === 2 ? <SummaryArt /> : null}
        </View>
        <T weight="extrabold" size={30} center>
          {page.title}
        </T>
        <T size={16} color={colors.muted} center style={{ marginTop: 12 }}>
          {page.body}
        </T>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 28 }}>
          {STEPS.map((item, index) => (
            <View
              key={item.title}
              style={{
                width: index === step ? 22 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: index === step ? colors.teal : colors.mintDeep,
              }}
            />
          ))}
        </View>
        {step === 2 ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            onPress={() => setChecked((value) => !value)}
            style={{ flexDirection: 'row', gap: 12, marginTop: 28, alignItems: 'flex-start' }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                borderWidth: 1.5,
                borderColor: colors.teal,
                backgroundColor: checked ? colors.teal : colors.white,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 2,
              }}
            >
              {checked ? <CheckIcon /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <T size={15}>I understand my recordings are transcribed by ElevenLabs and saved on this phone, and a summary is shared only if I approve it.</T>
            </View>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}
