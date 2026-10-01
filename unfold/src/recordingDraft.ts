export type RecordingDraft = {
  transcript: string;
  audioUri?: string;
};

let pending: RecordingDraft | null = null;

function release(uri?: string) {
  if (!uri?.startsWith('blob:') || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
  URL.revokeObjectURL(uri);
}

export function stageRecording(draft: RecordingDraft) {
  if (pending?.audioUri && pending.audioUri !== draft.audioUri) release(pending.audioUri);
  pending = {
    transcript: draft.transcript.trim(),
    audioUri: draft.audioUri,
  };
}

export function currentRecording(): RecordingDraft | null {
  return pending;
}

export function clearRecording() {
  release(pending?.audioUri);
  pending = null;
}
