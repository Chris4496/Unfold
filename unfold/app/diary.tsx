import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Back, Button, QuietButton, Screen, T } from '../src/components/ui';
import { dayKey, entryWhen, formatMonth, monthGrid } from '../src/lib/dates';
import { dailySummary } from '../src/lib/organise';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function DiaryScreen() {
  const store = useStore();
  const router = useRouter();
  const latest = [...store.entries].sort((a, b) => entryWhen(a).localeCompare(entryWhen(b))).at(-1);
  const initial = latest ? new Date(entryWhen(latest)) : new Date();
  const [cursor, setCursor] = useState({ year: initial.getFullYear(), month: initial.getMonth() });

  const marked = useMemo(() => new Set(store.entries.map((entry) => dayKey(entryWhen(entry)))), [store.entries]);
  const cells = monthGrid(cursor.year, cursor.month);
  const monthEntries = store.entries.filter((entry) => {
    const date = new Date(entryWhen(entry));
    return date.getFullYear() === cursor.year && date.getMonth() === cursor.month;
  });

  function shift(delta: number) {
    const date = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: date.getFullYear(), month: date.getMonth() });
  }

  return (
    <Screen scroll>
      <Back label="Home" href="/" />
      <T weight="extrabold" size={30}>
        Your diary
      </T>
      <T size={15} color={colors.muted} style={{ marginTop: 6, marginBottom: 16 }}>
        Tap a date to read that day. These summaries describe what you said. They are not an assessment.
      </T>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Pressable accessibilityRole="button" onPress={() => shift(-1)} hitSlop={8}>
          <T weight="bold" color={colors.teal}>‹</T>
        </Pressable>
        <T weight="bold">{formatMonth(cursor.year, cursor.month)}</T>
        <Pressable accessibilityRole="button" onPress={() => shift(1)} hitSlop={8}>
          <T weight="bold" color={colors.teal}>›</T>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((day, index) => (
          <View key={`${day}-${index}`} style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}>
            <T size={12} weight="semibold" color={colors.faint}>{day}</T>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((cell) => {
          const has = marked.has(cell.iso);
          return (
            <Pressable
              key={cell.iso}
              accessibilityRole="button"
              accessibilityLabel={`${cell.iso}${has ? ', has notes' : ''}`}
              onPress={() => router.push({ pathname: '/day/[date]', params: { date: cell.iso } })}
              style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 6 }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: has ? colors.tealSoft : 'transparent',
                }}
              >
                <T size={14} weight={has ? 'bold' : 'medium'} color={cell.inMonth ? colors.navy : colors.faint}>
                  {cell.day}
                </T>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={{ marginTop: 12, marginBottom: 8 }}>
        <T weight="bold">This month</T>
        <T size={15} color={colors.muted} style={{ marginTop: 6 }}>
          {monthEntries.length > 0 ? dailySummary(monthEntries).replace('Today', 'This month') : 'No notes this month.'}
        </T>
      </View>
      {store.shouldPrompt ? (
        <View style={{ marginTop: 8 }}>
          <Button label="See support options" onPress={() => router.push('/prompt')} />
        </View>
      ) : null}
      {store.entries.length === 0 ? (
        <View style={{ marginTop: 12, gap: 8 }}>
          <Button label="Record a note" onPress={() => router.replace('/')} />
          <Button
            label="Load sample notes"
            tone="secondary"
            onPress={() => {
              store.loadSamples();
            }}
          />
        </View>
      ) : null}
      <View style={{ alignItems: 'center', marginTop: 12 }}>
        <QuietButton label="Settings" onPress={() => router.push('/settings')} />
      </View>
    </Screen>
  );
}
