import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Back, Button, ButtonRow, Screen, T } from '../src/components/ui';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

export default function SettingsScreen() {
  const store = useStore();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudError, setCloudError] = useState(false);

  async function toggleCloud(next: boolean) {
    if (cloudBusy) return;
    setCloudBusy(true);
    setCloudError(false);
    const applied = await store.setCloudOrg(next);
    if (applied !== next) setCloudError(true);
    setCloudBusy(false);
  }

  return (
    <Screen scroll>
      <Back label="Back" />
      <T weight="extrabold" size={30}>Settings</T>
      <T size={15} color={colors.muted} style={{ marginTop: 8, marginBottom: 18 }}>
        Notes, transcripts and audio live on this phone. You choose separately whether anything else happens.
      </T>

      <View style={{ backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 16, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T weight="bold" size={17}>Cloud organisation</T>
          </View>
          <Switch
            accessibilityLabel="Cloud organisation"
            value={store.cloudOrg}
            disabled={cloudBusy}
            onValueChange={(value) => void toggleCloud(value)}
            trackColor={{ false: '#D5E3DE', true: colors.teal }}
            thumbColor={colors.white}
          />
        </View>
        <T size={14} color={colors.muted} style={{ marginTop: 10 }}>
          Optional, and independent of everything else. When on, only the de-identified text of your notes is sent to the
          Unfold server so it can organise themes, answer questions and prepare daily summaries. Your full transcripts
          and audio never leave this phone.
        </T>
        <T size={14} color={colors.muted} style={{ marginTop: 8 }}>
          This is separate from ElevenLabs transcription (which only turns recordings into text) and separate from
          sharing a summary with a social worker. You choose each one on its own, and you can turn this off at any time.
        </T>
        {cloudError ? (
          <T size={14} weight="semibold" color={colors.teal} style={{ marginTop: 8 }}>
            The server could not be reached. The setting was not changed.
          </T>
        ) : null}
      </View>

      <Button
        label="Load a sample week"
        onPress={() => {
          store.loadSamples();
          router.replace('/diary');
        }}
      />
      <View style={{ height: 12 }} />
      {confirm ? (
        <View style={{ gap: 10 }}>
          <T weight="bold">Delete every note, summary and message on this phone?</T>
          <ButtonRow>
            <Button label="Cancel" tone="secondary" onPress={() => setConfirm(false)} />
            <Button
              label="Delete all"
              onPress={() => {
                store.clearAll();
                setConfirm(false);
                router.replace('/');
              }}
            />
          </ButtonRow>
        </View>
      ) : (
        <Button label="Delete everything" tone="secondary" onPress={() => setConfirm(true)} />
      )}
      <T size={14} color={colors.muted} style={{ marginTop: 20 }}>
        The support prompt is a simple pattern check, not a clinical judgement. It never sends anything by itself.
      </T>
    </Screen>
  );
}
