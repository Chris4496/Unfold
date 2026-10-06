import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { GraphBackdrop, GraphNode } from '../src/components/graphNode';
import { StudentNav } from '../src/components/studentNav';
import { Button, Screen, T, useAppFonts } from '../src/components/ui';
import { dayKey, entryWhen, formatDay } from '../src/lib/dates';
import { layoutGraph, stepSprings, type LayoutPoint } from '../src/lib/graphLayout';
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

function topicNodeId(topic: TopicId): string {
  return `topic:${topic}`;
}

/** Drawn rather than typed: text glyphs sit on a baseline and never centre in a small button. */
function ZoomGlyph({ plus = false }: { plus?: boolean }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Line x1={2} y1={7} x2={12} y2={7} stroke={colors.teal} strokeWidth={2} strokeLinecap="round" />
      {plus ? <Line x1={7} y1={2} x2={7} y2={12} stroke={colors.teal} strokeWidth={2} strokeLinecap="round" /> : null}
    </Svg>
  );
}

function shortDate(entry: Entry): string {
  return new Date(entryWhen(entry)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function GraphScreen() {
  const store = useStore();
  const fonts = useAppFonts();
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [range, setRange] = useState<StudentDateRange>('month');
  const [selectedTopic, setSelectedTopic] = useState<TopicId | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef(pan);
  panRef.current = pan;
  const panStart = useRef(pan);
  const sidePanel = screenWidth > screenHeight && screenWidth > 840;
  const graphWidth = Math.max(300, Math.min(1500, screenWidth - (sidePanel ? 440 : 48)));
  // Landscape fills the viewport beside the panel; portrait gets a tall-ish canvas of its own.
  const graphHeight = sidePanel
    ? Math.max(320, Math.min(820, screenHeight - 200))
    : Math.max(340, Math.min(560, Math.round(graphWidth * 1.25)));

  const rangeEntries = useMemo(() => entriesInDateRange(store.entries, range), [store.entries, range]);
  const topicEntries = useMemo(
    () => selectedTopic ? rangeEntries.filter((entry) => entry.topics.includes(selectedTopic)) : rangeEntries,
    [rangeEntries, selectedTopic],
  );
  const graphTopics = useMemo(() => topicsInEntries(rangeEntries), [rangeEntries]);
  const pickedEntry = rangeEntries.find((entry) => entry.id === selectedEntryId) ?? null;
  const selectedEntry = pickedEntry ?? rangeEntries[0] ?? null;

  const links = useMemo(
    () => rangeEntries.flatMap((entry) => entry.topics.map((topic) => ({ source: entry.id, target: topicNodeId(topic) }))),
    [rangeEntries],
  );
  const restPositions = useMemo(
    () => layoutGraph(
      [...graphTopics.map((topic) => ({ id: topicNodeId(topic) })), ...rangeEntries.map((entry) => ({ id: entry.id }))],
      links,
      graphWidth,
      graphHeight,
    ),
    [graphTopics, rangeEntries, links, graphWidth, graphHeight],
  );
  // While a node is being dragged (and as it springs back) these override the resting layout.
  const [livePositions, setLivePositions] = useState<Record<string, LayoutPoint> | null>(null);
  const positions = livePositions ?? restPositions;
  const canvasRef = useRef<View>(null);
  const motion = useRef({
    points: {} as Record<string, LayoutPoint>,
    velocities: {} as Record<string, LayoutPoint>,
    pinned: null as string | null,
    grab: { x: 0, y: 0 },
    frame: null as number | null,
    origin: null as { x: number; y: number; width: number } | null,
    // A drag ends with a click on web; this stops that click selecting or deselecting.
    justDragged: false,
  }).current;
  // The gesture handlers are created once, so they read the latest render through this.
  const latest = useRef({ restPositions, links, zoom, pan, graphWidth, graphHeight });
  latest.current = { restPositions, links, zoom, pan, graphWidth, graphHeight };

  useEffect(() => {
    // A new layout (range or window size changed) abandons any motion in flight.
    if (motion.frame !== null) cancelAnimationFrame(motion.frame);
    motion.frame = null;
    motion.pinned = null;
    setLivePositions(null);
    return () => { if (motion.frame !== null) cancelAnimationFrame(motion.frame); };
  }, [restPositions, motion]);

  function runMotion() {
    if (motion.frame !== null) return;
    const tick = () => {
      const unrest = stepSprings(motion.points, motion.velocities, latest.current.restPositions, latest.current.links, motion.pinned);
      if (motion.pinned === null && unrest < 0.3) {
        motion.frame = null;
        setLivePositions(null);
        return;
      }
      setLivePositions(Object.fromEntries(Object.entries(motion.points).map(([id, point]) => [id, { ...point }])));
      motion.frame = requestAnimationFrame(tick);
    };
    motion.frame = requestAnimationFrame(tick);
  }

  /** Page coordinates → graph coordinates, undoing the canvas offset, pan and zoom. */
  function toGraphPoint(pageX: number, pageY: number): LayoutPoint | null {
    if (!motion.origin) return null;
    const { zoom: scale, pan: shift, graphWidth: width, graphHeight: height } = latest.current;
    const fit = width / Math.max(1, motion.origin.width);
    return {
      x: ((pageX - motion.origin.x) * fit - (width / 2) * (1 - scale) - shift.x) / scale,
      y: ((pageY - motion.origin.y) * fit - (height / 2) * (1 - scale) - shift.y) / scale,
    };
  }

  // Selecting a node lights up it and its neighbours and fades the rest, as in a notes graph.
  const focusId = selectedTopic ? topicNodeId(selectedTopic) : pickedEntry?.id ?? null;
  const lit = useMemo(() => {
    if (!focusId) return null;
    const ids = new Set([focusId]);
    for (const link of links) {
      if (link.source === focusId) ids.add(link.target);
      if (link.target === focusId) ids.add(link.source);
    }
    return ids;
  }, [focusId, links]);
  const dimmed = (id: string) => lit !== null && !lit.has(id);
  // Date labels crowd a small or busy canvas, so they wait for a zoom or a selection.
  const showNoteLabels = zoom >= 1.4 || (graphWidth >= 520 && rangeEntries.length <= 40);
  const zoomTransform = `translate(${(graphWidth / 2) * (1 - zoom) + pan.x} ${(graphHeight / 2) * (1 - zoom) + pan.y}) scale(${zoom})`;

  const panResponder = useMemo(
    () => PanResponder.create({
      // Leave taps to the nodes; only a real drag pans the canvas.
      onStartShouldSetPanResponderCapture: () => {
        // Never claims the touch; it only records where the canvas is before a drag begins.
        canvasRef.current?.measureInWindow((x, y, width) => { motion.origin = { x, y, width }; });
        return false;
      },
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 6,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (_, gesture) => {
        panStart.current = panRef.current;
        motion.justDragged = true;
        // A drag that starts on a node moves that node; anywhere else pans the canvas.
        const start = toGraphPoint(gesture.moveX - gesture.dx, gesture.moveY - gesture.dy);
        if (!start) return;
        const current = motion.frame !== null ? motion.points : latest.current.restPositions;
        const reach = 22 / latest.current.zoom;
        let nearest: string | null = null;
        let nearestDistance = reach;
        for (const [id, point] of Object.entries(current)) {
          const distance = Math.hypot(point.x - start.x, point.y - start.y);
          if (distance < nearestDistance) {
            nearest = id;
            nearestDistance = distance;
          }
        }
        if (!nearest) return;
        if (motion.frame === null) {
          motion.points = Object.fromEntries(Object.entries(current).map(([id, point]) => [id, { ...point }]));
          motion.velocities = {};
        }
        motion.pinned = nearest;
        motion.grab = { x: motion.points[nearest].x - start.x, y: motion.points[nearest].y - start.y };
      },
      onPanResponderMove: (_, gesture) => {
        if (motion.pinned === null) {
          setPan({ x: panStart.current.x + gesture.dx, y: panStart.current.y + gesture.dy });
          return;
        }
        const point = toGraphPoint(gesture.moveX, gesture.moveY);
        if (!point) return;
        motion.points[motion.pinned] = { x: point.x + motion.grab.x, y: point.y + motion.grab.y };
        runMotion();
      },
      onPanResponderRelease: endDrag,
      onPanResponderTerminate: endDrag,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function endDrag() {
    // Unpinned, the node springs back to its place; the loop stops itself once settled.
    motion.pinned = null;
    setTimeout(() => { motion.justDragged = false; }, 80);
  }

  /** Wraps a tap handler so the click that ends a drag is ignored. */
  const onTap = (action: () => void) => () => { if (!motion.justDragged) action(); };

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
            This topic label appears in {topicEntries.length} {topicEntries.length === 1 ? 'note' : 'notes'}. Graph links show shared topic labels only; they do not describe cause or meaning.
          </T>
          <Pressable accessibilityRole="button" onPress={() => setSelectedTopic(null)} style={{ alignSelf: 'flex-start', marginTop: 12 }}>
            <T size={13} weight="bold" color={colors.teal}>Show all topics</T>
          </Pressable>
          <View style={{ marginTop: 12, gap: 8 }}>
            {topicEntries.slice(0, 8).map((entry) => (
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
    <Screen wide scroll footer={<StudentNav active="dashboard" compact />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 210 }}>
          <T weight="extrabold" size={28}>Your notes graph</T>
          <T size={13} color={colors.muted} style={{ marginTop: 3 }}>Private on this phone · links mean shared topics only</T>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
          {RANGES.map((item) => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: range === item.id }} onPress={() => { setRange(item.id); setSelectedTopic(null); setPan({ x: 0, y: 0 }); }} style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: range === item.id ? colors.tealSoft : colors.white, paddingHorizontal: 10, paddingVertical: 8 }}>
              <T size={12} weight={range === item.id ? 'bold' : 'medium'} color={range === item.id ? colors.tealDark : colors.muted}>{item.label}</T>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: sidePanel ? 'row' : 'column', gap: 14, marginTop: 14, alignItems: 'stretch' }}>
        <View style={{ width: sidePanel ? graphWidth : '100%', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 18, overflow: 'hidden' }}>
          {rangeEntries.length > 0 ? (
            <View ref={canvasRef} collapsable={false} style={dragSurface} {...panResponder.panHandlers}>
              <Svg width="100%" height={graphHeight} viewBox={`0 0 ${graphWidth} ${graphHeight}`} accessibilityLabel="Interactive notes and shared-topic graph">
                <GraphBackdrop
                  width={graphWidth}
                  height={graphHeight}
                  onPress={onTap(() => { setSelectedEntryId(null); setSelectedTopic(null); })}
                />
                <G transform={zoomTransform}>
                  {links.map((link) => {
                    const from = positions[link.source];
                    const to = positions[link.target];
                    if (!from || !to) return null;
                    const active = focusId === link.source || focusId === link.target;
                    return (
                      <Line
                        key={`${link.source}-${link.target}`}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke={active ? colors.teal : colors.mintDeep}
                        strokeWidth={active ? 1.6 : 1}
                        opacity={focusId && !active ? 0.25 : 1}
                      />
                    );
                  })}
                  {rangeEntries.map((entry) => {
                    const point = positions[entry.id];
                    if (!point) return null;
                    const focused = focusId === entry.id;
                    const radius = 6.5 + Math.min(3, entry.topics.length) * 1.1 + (focused ? 1.5 : 0);
                    const highlighted = lit?.has(entry.id) ?? false;
                    return (
                      <GraphNode
                        key={entry.id}
                        onPress={onTap(() => { setSelectedEntryId(focused ? null : entry.id); setSelectedTopic(null); })}
                        label={`Note ${formatDay(entryWhen(entry))}: ${clip(entry.transcript, 90)}`}
                      >
                        {/* Invisible halo so small dots stay easy to tap. */}
                        <Circle cx={point.x} cy={point.y} r={17} fill={colors.white} opacity={0} />
                        <Circle
                          cx={point.x}
                          cy={point.y}
                          r={radius}
                          fill={focused ? colors.tealDark : highlighted ? colors.teal : colors.faint}
                          opacity={dimmed(entry.id) ? 0.25 : 1}
                        />
                        {showNoteLabels || highlighted ? (
                          <SvgText
                            x={point.x}
                            y={point.y + radius + 14}
                            textAnchor="middle"
                            fontSize={11}
                            fontFamily={focused ? fonts.bold : fonts.medium}
                            fill={highlighted ? colors.navy : colors.muted}
                            opacity={dimmed(entry.id) ? 0.25 : 1}
                          >
                            {shortDate(entry)}
                          </SvgText>
                        ) : null}
                      </GraphNode>
                    );
                  })}
                  {graphTopics.map((topic) => {
                    const id = topicNodeId(topic);
                    const point = positions[id];
                    if (!point) return null;
                    const focused = selectedTopic === topic;
                    const degree = links.filter((link) => link.target === id).length;
                    const radius = 10 + Math.min(11, Math.sqrt(degree) * 2.6);
                    return (
                      <GraphNode key={topic} onPress={onTap(() => { setSelectedTopic(focused ? null : topic); setSelectedEntryId(null); })} label={`Topic ${TOPIC_LABELS[topic]}, highlight its notes`}>
                        <Circle
                          cx={point.x}
                          cy={point.y}
                          r={radius}
                          fill={focused ? colors.tealDark : colors.teal}
                          stroke={focused ? colors.tealSoft : colors.white}
                          strokeWidth={focused ? 4 : 1.5}
                          opacity={dimmed(id) ? 0.25 : 1}
                        />
                        <SvgText
                          x={point.x}
                          y={point.y + radius + 17}
                          textAnchor="middle"
                          fontSize={13}
                          fontFamily={fonts.bold}
                          fill={colors.navy}
                          opacity={dimmed(id) ? 0.25 : 1}
                        >
                          {TOPIC_LABELS[topic]}
                        </SvgText>
                      </GraphNode>
                    );
                  })}
                </G>
              </Svg>
            </View>
          ) : (
            <View style={{ minHeight: 280, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
              <T weight="bold" size={18} center>No notes in this date range</T>
              <T size={14} color={colors.muted} center style={{ marginTop: 8 }}>Save a note or choose another date range to see your own notes here.</T>
              <View style={{ width: '100%', maxWidth: 240, marginTop: 14 }}><Button label="Record a note" onPress={() => router.replace('/')} /></View>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 12, paddingVertical: 8 }}>
            <T size={11} color={colors.muted}>{rangeEntries.length} {rangeEntries.length === 1 ? 'note' : 'notes'} · {graphTopics.length} {graphTopics.length === 1 ? 'topic' : 'topics'}</T>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" disabled={zoom >= 2.4} onPress={() => setZoom((value) => Math.min(2.4, Number((value + 0.2).toFixed(1))))} style={zoomButton}><ZoomGlyph plus /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" disabled={zoom <= 0.6} onPress={() => setZoom((value) => Math.max(0.6, Number((value - 0.2).toFixed(1))))} style={zoomButton}><ZoomGlyph /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Reset view" onPress={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={[zoomButton, { paddingHorizontal: 12 }]}><T size={12} weight="bold" color={colors.teal} style={{ lineHeight: 14 }}>Reset</T></Pressable>
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

const zoomButton = { minWidth: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: 'center' as const, justifyContent: 'center' as const };
// Stops a mouse drag selecting the graph's labels on web; the style is not in React Native's types.
const dragSurface = { userSelect: 'none' } as object;
