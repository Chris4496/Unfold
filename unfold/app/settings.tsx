import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Back, Button, ButtonRow, Screen, T } from '../src/components/ui';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

export default function SettingsScreen() {
  const store = useStore();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);

  return (
    <Screen scroll>
      <Back label="Back" />
      <T weight="extrabold" size={30}>Settings</T>
      <T size={15} color={colors.muted} style={{ marginTop: 8, marginBottom: 18 }}>
        This is a prototype on one phone. Notes, summaries and messages stay in this demo unless you delete them.
      </T>
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
        The support prompt is a simple pattern check for this prototype. It is not a clinical judgement, and it never sends anything by itself.
      </T>
    </Screen>
  );
}
