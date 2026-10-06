import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { StudentNav } from '../src/components/studentNav';
import { TimelineArt } from '../src/components/art';
import { Button, Screen, T } from '../src/components/ui';
import { dayKey, entryWhen, formatDay } from '../src/lib/dates';
import { entriesForTopic, entriesInDateRange, TOPIC_LABELS, topicsInEntries, type StudentDateRange } from '../src/lib/studentViews';
import { clip } from '../src/lib/text';
import type { TopicId } from '../src/types';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

const RANGES: { id: StudentDateRange; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All notes' },
];

export default function TimelineScreen() {
  const store = useStore();
  const router = useRouter();
  const [range, setRange] = useState<StudentDateRange>('month');
  const [selectedTopic, setSelectedTopic] = useState<TopicId | null>(null);
  const rangedEntries = useMemo(() => entriesInDateRange(store.entries, range), [store.entries, range]);
  const topics = useMemo(() => topicsInEntries(rangedEntries), [rangedEntries]);
  const entries = selectedTopic ? entriesForTopic(rangedEntries, selectedTopic) : rangedEntries;

  if (!store.ready) return <Screen><View style={{ padding: 24 }}><T>Loading your notes…</T></View></Screen>;
  if (!store.onboarded) return <Redirect href="/onboarding" />;

  function openCalendar() {
    router.push('/diary');
  }

  return (
    <Screen scroll footer={<StudentNav active="diary" />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <T weight="extrabold" size={29}>Your timeline</T>
          <T size={14} color={colors.muted} style={{ marginTop: 3 }}>Your notes, in the order you placed them.</T>
        </View>
        <TimelineArt />
      </View>
      <View accessibilityLabel="Timeline date range" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 15 }}>
        {RANGES.map((item) => (
          <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: range === item.id }} onPress={() => { setRange(item.id); setSelectedTopic(null); }} style={{ borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: range === item.id ? colors.tealSoft : colors.white, paddingHorizontal: 12, paddingVertical: 8 }}>
            <T size={12} weight={range === item.id ? 'bold' : 'medium'} color={range === item.id ? colors.tealDark : colors.muted}>{item.label}</T>
          </Pressable>
        ))}
      </View>

      <View style={{ marginBottom: 17, paddingLeft: 13, borderLeftWidth: 3, borderLeftColor: colors.mintDeep }}>
        {entries.map((entry) => (
          <View key={entry.id} style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <View style={{ width: 24, alignItems: 'center', paddingTop: 13 }}>
              <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: colors.teal, borderWidth: 2, borderColor: colors.white }} />
            </View>
            <View style={{ flex: 1, backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 14 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open note from ${formatDay(entryWhen(entry))}`} onPress={() => router.push({ pathname: '/day/[date]', params: { date: dayKey(entryWhen(entry)) } })}>
                <T size={12} weight="bold" color={colors.teal}>{formatDay(entryWhen(entry))}</T>
                <T size={15} style={{ marginTop: 6 }}>{clip(entry.transcript, 190)}</T>
                {entry.eventAt && dayKey(entry.eventAt) !== dayKey(entry.createdAt) ? (
                  <T size={11} color={colors.faint} style={{ marginTop: 6 }}>Saved {formatDay(entry.createdAt)} · date you chose for this note</T>
                ) : null}
              </Pressable>
              {entry.topics.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {entry.topics.map((topic) => (
                    <Pressable key={topic} accessibilityRole="button" accessibilityState={{ selected: selectedTopic === topic }} onPress={() => setSelectedTopic(selectedTopic === topic ? null : topic)} style={{ backgroundColor: selectedTopic === topic ? colors.teal : colors.tealSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <T size={12} weight="semibold" color={selectedTopic === topic ? colors.white : colors.tealDark}>{TOPIC_LABELS[topic]}</T>
                    </Pressable>
                  ))}
                </View>
              ) : <T size={12} color={colors.faint} style={{ marginTop: 9 }}>No topic labels</T>}
            </View>
          </View>
        ))}
      </View>
      {entries.length === 0 ? (
        <View style={{ backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 18, marginBottom: 14 }}>
          <T weight="bold">{selectedTopic ? `No ${TOPIC_LABELS[selectedTopic]} notes in this range.` : 'No notes in this date range.'}</T>
          <T size={14} color={colors.muted} style={{ marginTop: 6 }}>Choose another date range or record a note to see it here.</T>
          <View style={{ marginTop: 14 }}><Button label="Record a note" onPress={() => router.replace('/')} /></View>
        </View>
      ) : null}
      <View style={{ backgroundColor: colors.mint, borderRadius: 18, padding: 15, marginBottom: 14 }}>
        <T weight="bold" size={16}>Topics I mentioned</T>
        <T size={13} color={colors.muted} style={{ marginTop: 3, marginBottom: 10 }}>Choose a topic to see only notes with that tag.</T>
        {topics.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {topics.map((topic) => (
              <Pressable key={topic} accessibilityRole="button" accessibilityState={{ selected: selectedTopic === topic }} onPress={() => setSelectedTopic(selectedTopic === topic ? null : topic)} style={{ borderRadius: 999, backgroundColor: selectedTopic === topic ? colors.teal : colors.white, paddingHorizontal: 12, paddingVertical: 8 }}>
                <T size={13} weight="semibold" color={selectedTopic === topic ? colors.white : colors.tealDark}>{TOPIC_LABELS[topic]} · {entriesForTopic(rangedEntries, topic).length}</T>
              </Pressable>
            ))}
          </View>
        ) : <T size={13} color={colors.muted}>Topic labels will appear when notes have them.</T>}
        <T size={12} color={colors.muted} style={{ marginTop: 10 }}>Topics are labels from your notes, not a judgement about you.</T>
      </View>
      <View style={{ backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 13, marginBottom: 14 }}>
        <T size={13} color={colors.muted}>Your audio and full transcripts stay on this phone. Voice transcription sends audio to ElevenLabs. Optional cloud organisation sends de-identified text only when enabled in Settings.</T>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <Pressable accessibilityRole="button" onPress={openCalendar} hitSlop={8}><T size={14} weight="bold" color={colors.teal}>View diary calendar ›</T></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/graph')} hitSlop={8}><T size={14} weight="bold" color={colors.teal}>Explore notes graph</T></Pressable>
      </View>
    </Screen>
  );
}
