import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { GraphNode } from '../src/components/graphNode';
import { Button, Screen, T } from '../src/components/ui';
import { dayKey, entryWhen, formatDay } from '../src/lib/dates';
import { entriesInDateRange, TOPIC_LABELS, topicsInEntries, type StudentDateRange } from '../src/lib/studentViews';
import { clip } from '../src/lib/text';
import type { Entry, TopicId } from '../src/types';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

const RANGES: { id: StudentDateRange; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All notes' },
];

function shortDate(entry: Entry): string {
  return new Date(entryWhen(entry)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function GraphScreen() {
  const store = useStore();
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [range, setRange] = useState<StudentDateRange>('month');
  const [selectedTopic, setSelectedTopic] = useState<TopicId | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const sidePanel = screenWidth > screenHeight && screenWidth > 840;
  const graphWidth = Math.max(300, Math.min(1500, screenWidth - (sidePanel ? 440 : 48)));

  const rangeEntries = useMemo(() => entriesInDateRange(store.entries, range), [store.entries, range]);
  const graphEntries = useMemo(
    () => selectedTopic ? rangeEntries.filter((entry) => entry.topics.includes(selectedTopic)) : rangeEntries,
    [rangeEntries, selectedTopic],
  );
  const graphTopics = useMemo(() => topicsInEntries(rangeEntries), [rangeEntries]);
  const selectedEntry = graphEntries.find((entry) => entry.id === selectedEntryId) ?? graphEntries[0] ?? null;
  const columns = graphWidth > 620 ? 4 : 2;
  const rows = Math.ceil(graphEntries.length / columns);
  const topicColumns = graphWidth > 620 ? Math.max(1, graphTopics.length) : 3;
  const topicRows = Math.ceil(graphTopics.length / topicColumns);
  const noteStartY = 80 + topicRows * 76;
  const graphHeight = Math.max(310, noteStartY + rows * 112 + 40);
  const topicPositions = graphTopics.map((topic, index) => ({
    topic,
    x: graphWidth * ((index % topicColumns) + 0.5) / topicColumns,
    y: 40 + Math.floor(index / topicColumns) * 76,
  }));
  const notePositions = graphEntries.map((entry, index) => ({
    entry,
    x: graphWidth * ((index % columns) + 0.5) / columns,
    y: noteStartY + Math.floor(index / columns) * 112,
  }));
  const zoomTransform = `translate(${(graphWidth / 2) * (1 - zoom)} ${(graphHeight / 2) * (1 - zoom)}) scale(${zoom})`;

  if (!store.ready) return <Screen wide><View style={{ padding: 24 }}><T>Loading your notes…</T></View></Screen>;
  if (!store.onboarded) return <Redirect href="/onboarding" />;

  function openEntry(entry: Entry) {
    router.push({ pathname: '/day/[date]', params: { date: dayKey(entryWhen(entry)) } });
  }

  const panel = (
    <View style={{ backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 18, flex: sidePanel ? 1 : undefined }}>
      {selectedTopic ? (
        <>
          <T weight="bold" size={19}>{TOPIC_LABELS[selectedTopic]}</T>
          <T size={14} color={colors.muted} style={{ marginTop: 8 }}>
            This topic label appears in {graphEntries.length} {graphEntries.length === 1 ? 'note' : 'notes'}. Graph links show shared topic labels only; they do not describe cause or meaning.
          </T>
          <Pressable accessibilityRole="button" onPress={() => setSelectedTopic(null)} style={{ alignSelf: 'flex-start', marginTop: 12 }}>
            <T size={13} weight="bold" color={colors.teal}>Show all topics</T>
          </Pressable>
          <View style={{ marginTop: 12, gap: 8 }}>
            {graphEntries.slice(0, 8).map((entry) => (
              <Pressable key={entry.id} accessibilityRole="button" onPress={() => openEntry(entry)} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line }}>
                <T size={12} color={colors.muted}>{formatDay(entryWhen(entry))}</T>
                <T size={14} weight="semibold" style={{ marginTop: 3 }}>{clip(entry.transcript, 92)}</T>
                <T size={12} weight="semibold" color={colors.teal} style={{ marginTop: 4 }}>Open this diary day</T>
              </Pressable>
            ))}
          </View>
        </>
      ) : selectedEntry ? (
        <>
          <T weight="bold" size={19}>Selected note</T>
          <T size={14} weight="bold" style={{ marginTop: 14 }}>{formatDay(entryWhen(selectedEntry))}</T>
          <T size={15} style={{ marginTop: 8 }}>{selectedEntry.transcript}</T>
          {selectedEntry.topics.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
              {selectedEntry.topics.map((topic) => (
                <Pressable key={topic} accessibilityRole="button" accessibilityLabel={`Filter graph by ${TOPIC_LABELS[topic]}`} onPress={() => setSelectedTopic(topic)} style={{ backgroundColor: colors.tealSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <T size={12} weight="semibold" color={colors.tealDark}>{TOPIC_LABELS[topic]}</T>
                </Pressable>
              ))}
            </View>
          ) : <T size={13} color={colors.muted} style={{ marginTop: 10 }}>No topic labels on this note.</T>}
          <View style={{ marginTop: 18 }}><Button label="Open in diary" tone="secondary" onPress={() => openEntry(selectedEntry)} /></View>
        </>
      ) : (
        <>
          <T weight="bold" size={19}>Your notes graph</T>
          <T size={14} color={colors.muted} style={{ marginTop: 8 }}>Select a note or topic to explore your saved entries.</T>
          <View style={{ marginTop: 16 }}><Button label="Record a note" onPress={() => router.replace('/')} /></View>
        </>
      )}
      <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 18 }} />
      <T weight="bold" size={15}>Graph legend</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.muted }} /><T size={13}>Note</T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.teal }} /><T size={13}>Topic</T>
      </View>
      <T size={12} color={colors.muted} style={{ marginTop: 12 }}>Lines connect notes to shared topic tags. They do not show cause, judgement, or clinical meaning.</T>
    </View>
  );

  return (
    <Screen wide scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 210 }}>
          <T weight="extrabold" size={28}>Your notes graph</T>
          <T size={13} color={colors.muted} style={{ marginTop: 3 }}>Private on this phone · links mean shared topics only</T>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
          {RANGES.map((item) => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: range === item.id }} onPress={() => { setRange(item.id); setSelectedTopic(null); }} style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: range === item.id ? colors.tealSoft : colors.white, paddingHorizontal: 10, paddingVertical: 8 }}>
              <T size={12} weight={range === item.id ? 'bold' : 'medium'} color={range === item.id ? colors.tealDark : colors.muted}>{item.label}</T>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: sidePanel ? 'row' : 'column', gap: 14, marginTop: 14, alignItems: 'stretch' }}>
        <View style={{ width: sidePanel ? graphWidth : '100%', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 18, overflow: 'hidden' }}>
          {graphEntries.length > 0 ? (
            <Svg width="100%" height={graphHeight} viewBox={`0 0 ${graphWidth} ${graphHeight}`} accessibilityLabel="Interactive notes and shared-topic graph">
              <G transform={zoomTransform}>
                {notePositions.flatMap(({ entry, x: noteX, y: noteY }) => entry.topics.flatMap((topic) => {
                  const target = topicPositions.find((position) => position.topic === topic);
                  return target ? [<Line key={`${entry.id}-${topic}`} x1={target.x} y1={target.y + 47} x2={noteX} y2={noteY - 17} stroke={colors.mintDeep} strokeWidth={1.5} />] : [];
                }))}
                {topicPositions.map(({ topic, x, y }) => (
                  <GraphNode key={topic} onPress={() => setSelectedTopic(selectedTopic === topic ? null : topic)} label={`Topic ${TOPIC_LABELS[topic]}, filter notes`}>
                    <Circle cx={x} cy={y} r={selectedTopic === topic ? 25 : 21} fill={colors.teal} stroke={selectedTopic === topic ? colors.tealDark : colors.teal} strokeWidth={selectedTopic === topic ? 4 : 1} />
                    <SvgText x={x} y={y + 39} textAnchor="middle" fontSize={12} fontWeight="600" fill={colors.navy}>{TOPIC_LABELS[topic]}</SvgText>
                  </GraphNode>
                ))}
                {notePositions.map(({ entry, x, y }) => (
                  <GraphNode key={entry.id} onPress={() => { setSelectedEntryId(entry.id); setSelectedTopic(null); }} label={`Note ${formatDay(entryWhen(entry))}: ${clip(entry.transcript, 90)}`}>
                    <SvgText x={x} y={y - 22} textAnchor="middle" fontSize={10} fill={colors.muted}>{shortDate(entry)}</SvgText>
                    <Circle cx={x} cy={y} r={selectedEntry?.id === entry.id && !selectedTopic ? 15 : 12} fill={colors.muted} stroke={selectedEntry?.id === entry.id && !selectedTopic ? colors.teal : colors.white} strokeWidth={selectedEntry?.id === entry.id && !selectedTopic ? 3 : 1} />
                    <SvgText x={x} y={y + 29} textAnchor="middle" fontSize={9} fill={colors.navy}>{clip(entry.transcript, columns === 2 ? 20 : 15)}</SvgText>
                  </GraphNode>
                ))}
              </G>
            </Svg>
          ) : (
            <View style={{ minHeight: 280, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
              <T weight="bold" size={18} center>{selectedTopic ? `No ${TOPIC_LABELS[selectedTopic]} notes in this range` : 'No notes in this date range'}</T>
              <T size={14} color={colors.muted} center style={{ marginTop: 8 }}>Save a note or choose another date range to see your own notes here.</T>
              <View style={{ width: '100%', maxWidth: 240, marginTop: 14 }}><Button label="Record a note" onPress={() => router.replace('/')} /></View>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 12, paddingVertical: 8 }}>
            <T size={11} color={colors.muted}>{graphEntries.length} {graphEntries.length === 1 ? 'note' : 'notes'} · {graphTopics.length} {graphTopics.length === 1 ? 'topic' : 'topics'}</T>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" disabled={zoom >= 1.5} onPress={() => setZoom((value) => Math.min(1.5, Number((value + 0.2).toFixed(1))))} style={zoomButton}><T size={18} color={colors.teal}>+</T></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" disabled={zoom <= 0.7} onPress={() => setZoom((value) => Math.max(0.7, Number((value - 0.2).toFixed(1))))} style={zoomButton}><T size={18} color={colors.teal}>−</T></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Reset zoom" onPress={() => setZoom(1)} style={zoomButton}><T size={11} weight="bold" color={colors.teal}>Reset</T></Pressable>
            </View>
          </View>
        </View>
        {sidePanel ? panel : <View style={{ marginTop: 2 }}>{panel}</View>}
      </View>
      <View style={{ flexDirection: 'row', gap: 18, flexWrap: 'wrap', marginTop: 14 }}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/timeline')}><T size={14} weight="bold" color={colors.teal}>Open timeline</T></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/diary')}><T size={14} weight="bold" color={colors.teal}>Open diary calendar</T></Pressable>
      </View>
    </Screen>
  );
}

const zoomButton = { minWidth: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 7 };
