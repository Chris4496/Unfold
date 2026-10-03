import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SummaryArt } from '../src/components/art';
import { Button, ButtonRow, Card, Field, QuietButton, Screen, Stepper, T, TokenRow } from '../src/components/ui';
import { formatDay } from '../src/lib/dates';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

export default function ReviewScreen() {
  const store = useStore();
  const router = useRouter();
  const draft = store.draft;
  const [editing, setEditing] = useState(false);
  const [mainConcerns, setMainConcerns] = useState(draft?.mainConcerns ?? '');
  const [recentChange, setRecentChange] = useState(draft?.recentChange ?? '');
  const [open, setOpen] = useState(false);
  const [approving, setApproving] = useState(false);

  if (!draft) {
    return (
      <Screen footer={<Button label="Back home" onPress={() => router.replace('/')} />}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
          <T weight="bold" size={22} center>
            There is no summary to review yet.
          </T>
        </View>
      </Screen>
    );
  }

  function saveEdits() {
    store.updateDraft(mainConcerns, recentChange);
    setEditing(false);
  }

  async function approve() {
    if (approving) return;
    setApproving(true);
    try {
      const item = await store.approveSharing();
      if (item) router.replace('/shared');
    } finally {
      setApproving(false);
    }
  }

  return (
    <Screen
      scroll
      footer={
        <View style={{ gap: 4 }}>
          {editing ? (
            <ButtonRow>
              <Button label="Cancel" tone="secondary" onPress={() => setEditing(false)} />
              <Button label="Save" onPress={saveEdits} />
            </ButtonRow>
          ) : (
            <ButtonRow>
              <Button
                label="Edit"
                tone="secondary"
                onPress={() => {
                  setMainConcerns(draft.mainConcerns);
                  setRecentChange(draft.recentChange);
                  setEditing(true);
                }}
              />
              <Button label={approving ? 'Sharing…' : 'Approve sharing'} onPress={() => void approve()} disabled={approving} />
            </ButtonRow>
          )}
          {editing ? null : <QuietButton label="Not now" onPress={() => router.replace('/')} />}
        </View>
      }
    >
      <Stepper current={3} />
      <T weight="extrabold" size={32} center style={{ marginTop: 18, letterSpacing: -0.4 }}>
        Review your summary
      </T>
      <SummaryArt />
      <Card title="Main concerns">
        {editing ? <Field value={mainConcerns} onChangeText={setMainConcerns} /> : <T size={15} color={colors.muted}>{draft.mainConcerns}</T>}
      </Card>
      <Card title="Recent change">
        {editing ? <Field value={recentChange} onChangeText={setRecentChange} /> : <T size={15} color={colors.muted}>{draft.recentChange}</T>}
      </Card>
      <Card title="Privacy check">
        <TokenRow tokens={draft.tokens} empty="No names, schools or addresses were found." />
      </Card>
      <Pressable accessibilityRole="button" onPress={() => setOpen((value) => !value)} style={{ marginBottom: 8 }}>
        <T size={14} weight="semibold" color={colors.teal}>
          {open ? 'Hide what will be shared' : 'See what will be shared'}
        </T>
      </Pressable>
      {open ? (
        <Card title={draft.period}>
          {draft.excerpts.map((excerpt) => (
            <T key={excerpt.id} size={14} color={colors.muted} style={{ marginBottom: 8 }}>
              {`${formatDay(excerpt.createdAt)}: ${excerpt.text}`}
            </T>
          ))}
          <T size={13} color={colors.faint}>
            A social worker would see the two sentences above and these de-identified lines. Audio stays on this phone.
          </T>
        </Card>
      ) : null}
    </Screen>
  );
}
