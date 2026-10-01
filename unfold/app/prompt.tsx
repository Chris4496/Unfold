import { useRouter } from 'expo-router';
import { Back, Button, ButtonRow, Screen, T } from '../src/components/ui';
import { supportPromptCopy } from '../src/lib/organise';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

export default function PromptScreen() {
  const store = useStore();
  const router = useRouter();
  const ready = store.entries.length > 0 && store.shouldPrompt;

  return (
    <Screen
      scroll
      footer={
        ready ? (
          <ButtonRow>
            <Button
              label="Not now"
              tone="secondary"
              onPress={() => {
                store.dismissPrompt();
                router.replace('/');
              }}
            />
            <Button label="Prepare summary" onPress={() => router.push('/prepare')} />
          </ButtonRow>
        ) : (
          <Button label="Back to recording" onPress={() => router.replace('/')} />
        )
      }
    >
      <Back label="Home" href="/" />
      <T size={14} weight="semibold" color={colors.teal}>
        A choice, not a requirement
      </T>
      <T weight="extrabold" size={30} style={{ marginTop: 8 }}>
        Share a summary?
      </T>
      <T size={16} color={colors.navy} style={{ marginTop: 16 }}>
        {store.entries.length === 0
          ? 'Record a few notes first. A summary is only offered when similar difficulties show up on more than one day.'
          : supportPromptCopy(store.entries)}
      </T>
      <T size={14} color={colors.muted} style={{ marginTop: 16 }}>
        You can choose not to send it. Unfold does not diagnose, score, or contact anyone by itself.
      </T>
    </Screen>
  );
}
