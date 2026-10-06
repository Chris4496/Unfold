import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { StudentNav } from '../src/components/studentNav';
import { Button, Screen, T } from '../src/components/ui';
import { dayKey, entryWhen, formatDay } from '../src/lib/dates';
import { clip } from '../src/lib/text';
import { entriesForTopic, entriesInDateRange, TOPIC_LABELS, topicsInEntries, weeklyStats } from '../src/lib/studentViews';
import type { TopicId } from '../src/types';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

export default function DashboardScreen() {
  const store = useStore();
  const router = useRouter();
  const [selectedTopic, setSelectedTopic] = useState<TopicId | null>(null);
  const stats = useMemo(() => weeklyStats(store.entries), [store.entries]);
  const allTopics = useMemo(() => topicsInEntries(store.entries), [store.entries]);
  const recentEntries = useMemo(
    () => (selectedTopic ? entriesForTopic(store.entries, selectedTopic) : entriesInDateRange(store.entries, 'all')).slice(0, 4),
    [store.entries, selectedTopic],
  );

  if (!store.ready) return <Screen><View style={{ padding: 24 }}><T>Loading your notes…</T></View></Screen>;
  if (!store.onboarded) return <Redirect href="/onboarding" />;

  function openDay(date: string) {
    router.push({ pathname: '/day/[date]', params: { date } });
  }

  return (
    <Screen
      scroll
      footer={<StudentNav active="dashboard" />}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T weight="extrabold" size={30}>Your dashboard</T>
          <T size={15} color={colors.muted} style={{ marginTop: 4, marginBottom: 18 }}>
            A gentle look back at your notes.
          </T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => router.push('/settings')} hitSlop={8}>
          <T size={14} weight="semibold" color={colors.teal}>Settings</T>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 14 }}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/graph')} hitSlop={6}>
          <T size={14} weight="bold" color={colors.teal}>Explore notes graph</T>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/timeline')} hitSlop={6}>
          <T size={14} weight="bold" color={colors.teal}>View timeline</T>
        </Pressable>
      </View>

      <View style={{ backgroundColor: colors.mint, borderRadius: 24, padding: 18, marginBottom: 18 }}>
        <T weight="bold" size={20}>This week</T>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 12 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 16, padding: 12 }}>
            <T weight="extrabold" size={30}>{stats.noteCount}</T>
            <T size={14} color={colors.muted}>{stats.noteCount === 1 ? 'note' : 'notes'}</T>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 16, padding: 12 }}>
            <T weight="extrabold" size={30}>{stats.uniqueTopicCount}</T>
            <T size={14} color={colors.muted}>{stats.uniqueTopicCount === 1 ? 'theme' : 'themes'}</T>
          </View>
        </View>
        <T size={13} weight="semibold" color={colors.muted} style={{ marginTop: 16, marginBottom: 6 }}>
          Monday – Sunday · based on the date you placed each note
        </T>
        <View accessibilityLabel="This week's daily note activity" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
          {stats.activity.map((day) => {
            const active = day.count > 0;
            return (
              <Pressable
                key={day.key}
                accessibilityRole={active ? 'button' : undefined}
                accessibilityLabel={`${day.label}: ${day.count} ${day.count === 1 ? 'note' : 'notes'}`}
                disabled={!active}
                onPress={() => openDay(day.key)}
                style={{ flex: 1, alignItems: 'center', minHeight: 74, justifyContent: 'flex-end', paddingTop: 4 }}
              >
                <T size={11} weight="semibold" color={active ? colors.tealDark : colors.faint}>{day.count || ''}</T>
                <View style={{
                  width: '58%',
                  minWidth: 8,
                  height: active ? Math.min(34, 11 + day.count * 8) : 7,
                  borderRadius: 999,
                  marginTop: 5,
                  backgroundColor: active ? colors.teal : colors.white,
                  borderWidth: active ? 0 : 1,
                  borderColor: colors.mintDeep,
                }} />
                <T size={10} color={colors.muted} style={{ marginTop: 5 }}>{day.label}</T>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 16, marginBottom: 16 }}>
        <T weight="bold" size={20}>Themes in your notes</T>
        <T size={14} color={colors.muted} style={{ marginTop: 4, marginBottom: 12 }}>
          These labels come from your notes. Choose one to find related entries.
        </T>
        {allTopics.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {allTopics.map((topic) => {
              const selected = selectedTopic === topic;
              const count = entriesForTopic(store.entries, topic).length;
              return (
                <Pressable
                  key={topic}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedTopic(selected ? null : topic)}
                  style={{ borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: selected ? colors.teal : colors.tealSoft }}
                >
                  <T size={14} weight="semibold" color={selected ? colors.white : colors.tealDark}>
                    {TOPIC_LABELS[topic]} · {count}
                  </T>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <T size={14} color={colors.muted}>Themes will appear here after you save a note.</T>
        )}
        <T size={13} color={colors.muted} style={{ marginTop: 12 }}>
          A topic is only a word pattern in a note, not a judgement about you.
        </T>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <T weight="bold" size={20}>{selectedTopic ? `${TOPIC_LABELS[selectedTopic]} notes` : 'Recent notes'}</T>
        {selectedTopic ? (
          <Pressable accessibilityRole="button" onPress={() => setSelectedTopic(null)} hitSlop={8}>
            <T size={13} weight="semibold" color={colors.teal}>Clear filter</T>
          </Pressable>
        ) : null}
      </View>
      {recentEntries.map((entry) => (
        <Pressable
          key={entry.id}
          accessibilityRole="button"
          accessibilityLabel={`Open note from ${formatDay(entryWhen(entry))}`}
          onPress={() => openDay(dayKey(entryWhen(entry)))}
          style={{ backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 16, marginBottom: 10 }}
        >
          <T size={13} color={colors.muted}>{formatDay(entryWhen(entry))} · Private note</T>
          <T size={16} weight="semibold" style={{ marginTop: 8 }}>{clip(entry.transcript, 150)}</T>
          {entry.topics.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {entry.topics.map((topic) => (
                <View key={topic} style={{ backgroundColor: colors.mint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <T size={12} color={colors.tealDark}>{TOPIC_LABELS[topic]}</T>
                </View>
              ))}
            </View>
          ) : null}
        </Pressable>
      ))}
      {recentEntries.length === 0 ? (
        <View style={{ backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 16, marginBottom: 14 }}>
          <T weight="semibold">{selectedTopic ? `No notes tagged ${TOPIC_LABELS[selectedTopic]} yet.` : 'Your saved notes will appear here.'}</T>
          <T size={14} color={colors.muted} style={{ marginTop: 5 }}>Your notes stay on this phone unless you choose cloud organisation in Settings.</T>
        </View>
      ) : null}

      <View style={{ backgroundColor: colors.pill, borderRadius: 18, padding: 14, marginTop: 4 }}>
        <T size={14} weight="semibold">{store.cloudOrg ? 'Cloud organisation is on' : 'Cloud organisation is off'}</T>
        <T size={13} color={colors.muted} style={{ marginTop: 5 }}>
          Saved audio and full transcripts stay on this phone. If you choose voice transcription, that recording is sent to ElevenLabs to turn it into text. {store.cloudOrg ? 'Only de-identified note text is sent to Unfold for organisation; you can turn this off in Settings.' : 'No note text is sent to Unfold for cloud organisation.'}
        </T>
        <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
          <T size={13} weight="bold" color={colors.teal}>Privacy and settings</T>
        </Pressable>
      </View>
      <View style={{ marginTop: 16, marginBottom: 14 }}>
        <Button label="Record a note" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}
