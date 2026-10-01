import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Back, Screen, T } from '../../src/components/ui';
import { formatDay } from '../../src/lib/dates';
import { useStore } from '../../src/store';
import { colors } from '../../src/theme';
import type { CaseStatus } from '../../src/types';

const STATUS: Record<CaseStatus, string> = {
  queued: 'Waiting for a reply',
  rematch: 'Asked for someone else',
  replied: 'Reply sent',
  continued: 'Conversation open',
  withdrawn: 'Withdrawn',
};

export default function WorkerListScreen() {
  const store = useStore();
  const router = useRouter();
  const cases = store.cases.filter((item) => item.status !== 'withdrawn');

  return (
    <Screen scroll>
      <Back label="Home" href="/" />
      <T weight="extrabold" size={30}>Social worker queue</T>
      <T size={15} color={colors.muted} style={{ marginTop: 8, marginBottom: 16 }}>
        This demo keeps the queue on this phone. A summary appears here only after the student approves it. Audio is not included.
      </T>
      {cases.length === 0 ? (
        <T size={16}>No summaries have been approved.</T>
      ) : (
        cases.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/worker/[id]', params: { id: item.id } })}
            style={{ backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 16, marginBottom: 12 }}
          >
            <T size={12} weight="semibold" color={colors.teal}>{STATUS[item.status]}</T>
            <T weight="bold" size={16} style={{ marginTop: 6 }}>{item.summary.mainConcerns}</T>
            <T size={14} color={colors.muted} style={{ marginTop: 4 }}>{item.summary.recentChange}</T>
            <T size={12} color={colors.faint} style={{ marginTop: 8 }}>{formatDay(item.createdAt)}</T>
          </Pressable>
        ))
      )}
      <View />
    </Screen>
  );
}
