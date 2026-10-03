import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { analysisWithFallback, type AnalysisOutcome } from '../src/api';
import { Back, Button, ButtonRow, Screen, T } from '../src/components/ui';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

export default function PromptScreen() {
  const store = useStore();
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisOutcome | null>(null);

  // Background support analysis: server-side when cloud organisation is on,
  // otherwise the existing local shouldOfferSupport/supportPromptCopy rules.
  useEffect(() => {
    let active = true;
    analysisWithFallback(store.cloudOrg ? store.deviceToken : null, store.entries)
      .then((outcome) => {
        if (active) setAnalysis(outcome);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.cloudOrg, store.deviceToken, store.entries.length]);

  const approaching = analysis ? analysis.approaching : store.shouldPrompt;
  const ready = store.entries.length > 0 && approaching;

  return (
    <Screen
      scroll
      footer={
        ready ? (
          <ButtonRow>
            <Button
              label="Not now"
              tone="secondary"
              onPress={() => {
                store.dismissPrompt();
                router.replace('/');
              }}
            />
            <Button label="Prepare summary" onPress={() => router.push('/prepare')} />
          </ButtonRow>
        ) : (
          <Button label="Back to recording" onPress={() => router.replace('/')} />
        )
      }
    >
      <Back label="Home" href="/" />
      <T size={14} weight="semibold" color={colors.teal}>
        A choice, not a requirement
      </T>
      <T weight="extrabold" size={30} style={{ marginTop: 8 }}>
        Share a summary?
      </T>
      <T size={16} color={colors.navy} style={{ marginTop: 16 }}>
        {store.entries.length === 0
          ? 'Record a few notes first. A summary is only offered when similar difficulties show up on more than one day.'
          : (analysis?.explanation ?? '')}
      </T>
      {analysis && store.entries.length > 0 ? (
        <T size={12} color={colors.faint} style={{ marginTop: 8 }}>
          {analysis.source === 'cloud'
            ? analysis.genai
              ? 'Pattern check by the cloud organiser (AI).'
              : 'Pattern check by the cloud organiser (server rules — not AI).'
            : 'Pattern check on this phone.'}
        </T>
      ) : null}
      <T size={14} color={colors.muted} style={{ marginTop: 16 }}>
        This is a pattern check, not a clinical judgement. You can choose not to send it. Unfold does not diagnose,
        score, or contact anyone by itself.
      </T>
    </Screen>
  );
}
