import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { respondWithFallback, type BriefResponseResult, type Source } from '../src/api';
import { CheckIcon } from '../src/components/art';
import { Button, Screen, T } from '../src/components/ui';
import { daysAgo } from '../src/lib/dates';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

type Brief = (BriefResponseResult & { source: Source }) | null;

const CHOICES = [
  { label: 'Today', offset: 0 },
  { label: 'Yesterday', offset: 1 },
  { label: 'A few days ago', offset: 3 },
];

export default function SavedScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const store = useStore();
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [brief, setBrief] = useState<Brief>(null);

  // Optional brief response from the cloud organiser. Fire-and-forget: it
  // never blocks saving, and the static copy below is the local fallback.
  useEffect(() => {
    if (!store.cloudOrg || !store.deviceToken || !id) return;
    const entry = store.entries.find((item) => item.id === id);
    if (!entry) return;
    let active = true;
    respondWithFallback(store.deviceToken, {
      deidentified: entry.deidentified,
      recentKinds: store.recentResponseKinds,
    })
      .then((result) => {
        if (!active || !result) return;
        setBrief(result);
        store.noteResponseKind(result.kind);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function choose(label: string, offset: number) {
    setPicked(label);
    if (id) store.setEventTime(id, offset === 0 ? new Date().toISOString() : daysAgo(offset));
  }

  return (
    <Screen footer={<Button label="Done" onPress={() => router.replace('/')} />}>
      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' }}>
            <CheckIcon size={28} />
          </View>
          <T weight="extrabold" size={28} center style={{ marginTop: 20 }}>
            {brief ? brief.text : 'Received. This entry has been saved.'}
          </T>
          <T size={16} color={colors.muted} center style={{ marginTop: 10 }}>
            You can stop here. It stays on this phone.
          </T>
          {brief ? (
            <T size={12} color={colors.faint} center style={{ marginTop: 8 }}>
              {brief.genai ? 'A brief note from the cloud organiser (AI)' : 'A brief note from the cloud organiser (not AI)'}
            </T>
          ) : null}
        </View>
        <View style={{ marginTop: 28, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 16 }}>
          <T weight="bold" size={16}>
            If you would like, you can add roughly when this happened.
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {CHOICES.map((choice) => {
              const selected = picked === choice.label;
              return (
                <Pressable
                  key={choice.label}
                  accessibilityRole="button"
                  onPress={() => choose(choice.label, choice.offset)}
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    backgroundColor: selected ? colors.teal : colors.pill,
                  }}
                >
                  <T size={14} weight="semibold" color={selected ? colors.white : colors.navy}>
                    {choice.label}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Screen>
  );
}
