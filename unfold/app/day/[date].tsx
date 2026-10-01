import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Back, Button, ButtonRow, Card, Screen, T } from '../../src/components/ui';
import { dayKey, formatDay, formatTime, parseDayKey } from '../../src/lib/dates';
import { dailySummary } from '../../src/lib/organise';
import { useStore } from '../../src/store';
import { colors } from '../../src/theme';

export default function DayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const store = useStore();
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const key = typeof date === 'string' ? date : '';
  const entries = store.entries
    .filter((entry) => dayKey(entry.createdAt) === key)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const heading = key ? formatDay(parseDayKey(key).toISOString()) : 'This day';

  return (
    <Screen scroll>
      <Back label="Diary" href="/diary" />
      <T weight="extrabold" size={30}>
        {heading}
      </T>
      <T size={16} color={colors.muted} style={{ marginTop: 8, marginBottom: 16 }}>
        {entries.length > 0 ? dailySummary(entries) : 'No notes on this day.'}
      </T>
      {entries.map((entry) => (
        <Card key={entry.id} title={formatTime(entry.createdAt)}>
          <T size={15}>{entry.transcript}</T>
          {entry.eventAt ? (
            <T size={13} color={colors.faint} style={{ marginTop: 8 }}>
              {`You placed this around ${formatDay(entry.eventAt)}.`}
            </T>
          ) : null}
          <T size={13} color={colors.faint} style={{ marginTop: 8 }}>
            On this phone
          </T>
          {pendingDelete === entry.id ? (
            <View style={{ marginTop: 12 }}>
              <T size={14} weight="semibold">Delete this note from the phone?</T>
              <ButtonRow>
                <Button label="Cancel" tone="secondary" onPress={() => setPendingDelete(null)} />
                <Button
                  label="Delete"
                  onPress={() => {
                    store.deleteEntry(entry.id);
                    setPendingDelete(null);
                  }}
                />
              </ButtonRow>
            </View>
          ) : (
            <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
              <Button label="Delete" tone="secondary" onPress={() => setPendingDelete(entry.id)} />
            </View>
          )}
        </Card>
      ))}
      <Button label="Record something else" onPress={() => router.replace('/')} />
    </Screen>
  );
}
