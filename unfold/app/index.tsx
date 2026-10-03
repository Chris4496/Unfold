import * as Haptics from 'expo-haptics';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { CalendarIcon, RecordButton, SearchIcon } from '../src/components/art';
import { Button, ButtonRow, LockPill, Notice, QuietButton, Screen, T } from '../src/components/ui';
import { clearRecording, stageRecording } from '../src/recordingDraft';
import { useStore } from '../src/store';
import { colors } from '../src/theme';
import { useVoiceCapture } from '../src/useVoiceCapture';

function clock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes}:${String(remain).padStart(2, '0')}`;
}

export default function HomeScreen() {
  const store = useStore();
  const capture = useVoiceCapture();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  if (!store.ready) return <Screen><View /></Screen>;
  if (!store.onboarded) return <Redirect href="/onboarding" />;

  async function onRecord() {
    if (saving) return;
    if (capture.recording) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      setSaving(true);
      try {
        const result = await capture.stop();
        if (result.transcript || result.audioUri) {
          stageRecording({ transcript: result.transcript, audioUri: result.audioUri });
        } else {
          clearRecording();
        }
        router.push('/write');
      } finally {
        setSaving(false);
      }
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    const started = await capture.start();
    if (!started) {
      clearRecording();
      router.push({ pathname: '/write', params: { reason: 'mic' } });
    }
  }

  const unseen = store.openCase && !store.openCase.seenReply && store.openCase.status === 'replied';

  return (
    <Screen decor>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Open diary" onPress={() => router.push('/diary')} style={iconHit}>
            <CalendarIcon />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Ask about your notes" onPress={() => router.push('/ask')} style={iconHit}>
            <SearchIcon />
          </Pressable>
        </View>
        <View style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 12 }}>
          <T weight="extrabold" size={34} center style={{ letterSpacing: -0.6 }}>
            Your private space
          </T>
          <T size={20} color={colors.muted} center style={{ marginTop: 10, marginBottom: 22 }}>
            {saving ? 'Preparing your note…' : capture.recording ? clock(capture.seconds) : 'What is on your mind?'}
          </T>
          <RecordButton recording={capture.recording} onPress={onRecord} />
          <T size={16} color={colors.muted} center style={{ marginTop: 18 }}>
            {saving ? 'One moment' : capture.recording ? 'Tap to stop' : 'Tap to record'}
          </T>
          {capture.recording && capture.partial ? (
            <View style={{ marginTop: 18, backgroundColor: colors.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.line }}>
              <T size={14} color={colors.muted}>
                {capture.partial}
              </T>
            </View>
          ) : null}
          {!capture.recording && !saving ? (
            <View style={{ marginTop: 22, alignItems: 'center', gap: 8, width: '100%' }}>
              <LockPill onPress={() => router.push('/privacy')} />
              <QuietButton
                label="Type instead"
                onPress={() => {
                  clearRecording();
                  router.push('/write');
                }}
              />
              {store.entries.length > 0 ? (
                <QuietButton label={`${store.entries.length} ${store.entries.length === 1 ? 'note' : 'notes'} on this phone`} onPress={() => router.push('/diary')} />
              ) : (
                <QuietButton label="Preview a sample week" onPress={() => { store.loadSamples(); router.push('/diary'); }} />
              )}
              {store.openCase && !unseen ? (
                <QuietButton label="View shared summary" onPress={() => router.push({ pathname: '/case', params: { id: store.openCase!.id } })} />
              ) : null}
              {unseen && store.openCase ? (
                <Notice title="A social worker replied" body="You can read it and choose whether to continue.">
                  <Button label="Read the reply" onPress={() => router.push({ pathname: '/case', params: { id: store.openCase!.id } })} />
                </Notice>
              ) : null}
              {!unseen && store.shouldPrompt ? (
                <Notice title="A few notes have continued" body="You can prepare a short summary, or keep this private.">
                  <ButtonRow>
                    <Button label="Not now" tone="secondary" onPress={store.dismissPrompt} />
                    <Button label="See options" onPress={() => router.push('/prompt')} />
                  </ButtonRow>
                </Notice>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const iconHit = { width: 44, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const };
