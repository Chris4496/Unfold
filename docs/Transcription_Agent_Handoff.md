# Agent handoff: transcription must work on web, Expo Go, and compiled apps

Unfold is an Expo SDK 57 app in `unfold/`. Students record a voice note. After they stop, the app opens **What did you want to say?** and must put a transcript of that recording into the note box. Cantonese and English both have to work. The student can edit the text, then save it on the phone.

The user requirement is that this transcription works in every place they run the app:

- the browser (`npm run web`, and a web export)
- Expo Go on a phone
- a compiled iOS app
- a compiled Android app

Today only the browser does it. Expo Go and a compiled native app record audio, then open the note page with an empty box.

## What already works

Verified in Chrome on 2 Oct 2026, with live browser speech recognition disabled so the text could only come from the saved audio:

- Cantonese audio of 「我今日好攰，唔想做功課，想休息一下。」 became `我今日好攰唔想做功課想休息一下`
- English audio of “I feel tired and I do not want to do my homework.” became `I feel tired and I do not want to do my home work`

Those results are on draft PR https://github.com/Chris4496/Unfold/pull/4, branch `cursor/transcribe-recording-26c3`.

## Current flow

1. `unfold/src/useVoiceCapture.ts` records with `expo-audio` (`RecordingPresets.HIGH_QUALITY`) and, at the same time, calls `startDictation` in `unfold/src/speech.ts`.
2. On stop, `unfold/app/index.tsx` stores `{ transcript, audioUri }` through `stageRecording` and opens `/write`.
3. `unfold/app/write.tsx` ignores the live transcript when an audio file exists. It calls `transcribeRecording(audioUri)` and puts that text in the box. If the user has already edited the box, their edit is kept (`nextComposerText` in `unfold/src/lib/transcriptText.ts`).
4. Save calls `store.addEntry(text, audioUri)`. `annotateEntry` in `unfold/src/lib/organise.ts` keeps only `file:` and `content:` audio URIs. Web `blob:` URIs are dropped. The transcript string is what the diary shows.

Live dictation is a preview only. It is not the source of the saved text when an audio file exists.

## Why native does not transcribe

`transcribeRecording` in `unfold/src/transcribeAudio.ts` returns `''` immediately unless `window` and `AudioContext` exist. Expo Go and a compiled React Native app do not have those browser APIs.

The web implementation then does three more browser-only things:

- Decode the recording with `AudioContext.decodeAudioData`. Web recordings are `audio/webm` blob URLs. Native recordings are `.m4a` AAC files (`file://` on iOS, often `content://` or `file://` on Android) at 44.1 kHz stereo.
- Load `@huggingface/transformers@3.8.1` with a browser dynamic `import()` from jsDelivr. Hermes cannot import an `https:` module URL.
- Run `onnx-community/whisper-small-cantonese-ONNX` with `device: 'wasm'` and `dtype: 'q4f16'`.

`startDictation` uses `SpeechRecognition` / `webkitSpeechRecognition` with `lang = 'yue-Hant-HK'`. That API is absent on native, so the live transcript is empty there too.

What the student sees on Expo Go or a compiled app: recording can start, stop opens **What did you want to say?**, the phase becomes `failed`, and the box stays empty with “Write your note in the box.”

## Model choice, already tested

Use the Cantonese fine-tune. Stock multilingual Whisper is not good enough.

| Model | Cantonese clip | English clip |
| --- | --- | --- |
| `onnx-community/whisper-tiny.en` | No Cantonese support | English works |
| `onnx-community/whisper-tiny`, language auto | Wrong English paraphrase | Correct English |
| `onnx-community/whisper-tiny`, language `chinese` | Rough Mandarin-like text (`我今天好距,不想再公佛…`) | Not tested as the keeper |
| `onnx-community/whisper-base`, language auto | English paraphrase, not Cantonese | Correct English |
| `onnx-community/whisper-base`, language `chinese` | Readable written Chinese, not spoken Cantonese (`我今天很累,不想做功課…`) | English audio was transcribed as Chinese |
| `onnx-community/whisper-small-cantonese-ONNX`, no language and no task | Exact spoken Cantonese, missing punctuation | Correct English |

The ONNX model’s generation config is marked English-only. Passing `language` or `task` throws: `Cannot specify task or language for an English-only model`. Call it with no language and no task. The weights still transcribe both languages. A GGML build of the same fine-tune is published by `alvanlii/whisper-small-cantonese` for whisper.cpp. Prefer that file over a stock `ggml-small.bin` or `ggml-tiny.bin`.

Do not force `language: 'zh'` or `language: 'yue'` on a stock Whisper model. Forcing Chinese makes English notes come out in Chinese. Auto-detect on stock tiny/base treats this Cantonese clip as English.

## Product constraints

- Original audio and the full transcript stay on the device. Do not send the recording to a cloud speech API.
- The note box on **What did you want to say?** is the destination of the transcript. Do not skip that page and auto-save.
- Keep the edit-before-save behavior.
- Cantonese and English must both survive. A Cantonese-only model that destroys English is not acceptable.
- Topic tags in `unfold/src/lib/organise.ts` are English keywords. A Cantonese transcript still has to be stored and shown even when no topic matches. Fixing Cantonese topic detection is out of scope unless it falls out of the same change.

## Hard limit: Expo Go cannot load a native speech engine

`whisper.rn` (whisper.cpp) is the realistic on-device engine for a compiled Expo app. Its own Expo guide says Expo Go cannot load it. You must `npx expo prebuild` and run a development build or a release build (`npx expo run:ios`, `npx expo run:android`, or EAS). The same is true of `onnxruntime-react-native` and `@react-native-voice/voice`.

Expo Go is a prebuilt binary. It includes Expo SDK modules such as `expo-audio`. It does not include Whisper. `expo-speech` is text-to-speech, not recognition. There is no pure-JavaScript engine in this app that can run the Cantonese small model inside Hermes.

So a native module makes transcription work in a compiled app and in an Expo dev client. It still does nothing inside the Expo Go app from the stores.

That is the conflict in the user’s request. “All places” includes Expo Go, and the engine that can actually transcribe Cantonese on a phone cannot run there. Do not report Expo Go as done just because a dev client works. Say which binary was tested.

Practical resolution to implement:

1. Keep the current web path (`transcribeAudio.ts`) for `Platform.OS === 'web'`.
2. On iOS and Android, transcribe the `expo-audio` file with `whisper.rn` (or equivalent whisper.cpp) using the GGML build of `alvanlii/whisper-small-cantonese`. Download and cache that model on device the first time. Do not upload the recording.
3. Add `expo-dev-client` and document that phones must use the dev client or a compiled build, not Expo Go. Treat the dev client as the phone runtime that satisfies “compiled app” and day-to-day device testing.
4. If a later decision truly requires the store Expo Go binary, stop and say it cannot run this model. Do not switch the app to a remote transcription API to paper over that gap.

## Implementation notes for the native path

- Native files are AAC in an `.m4a` container, 44.1 kHz, stereo. whisper.cpp wants 16 kHz mono PCM. `whisper.rn` usually resamples itself. Confirm that with the Cantonese fixture before writing a second decoder.
- Pass the filesystem path whisper.rn expects. `file://` prefixes often need to be stripped. `content://` Android URIs may need to be copied to a cache file first.
- Leave language and task unset on the Cantonese fine-tune, matching the web result. If the GGML build requires a language code, test both fixtures before choosing one. Reject a setting that turns the English fixture into Chinese.
- First launch will download a model on the order of the web `q4f16` weights (encoder about 54 MB plus decoder about 145 MB for the ONNX build; the GGML file is a different size). Show the existing preparing and transcribing states. The recording stays on the phone.
- `transcribeRecording` should be the single function `write.tsx` calls. Branch internally on `Platform.OS`. Do not fork the note-page UI.
- Web must keep working. Do not load `whisper.rn` on web. Guard the import so the web bundle does not crash.
- iOS needs microphone usage text (already in the `expo-audio` config plugin) and whatever speech-model permission whisper.rn documents. Android already requests record audio through that plugin.

## Acceptance tests

Run the same two clips on web, on a compiled iOS build or simulator, and on a compiled Android build or emulator. Also open Expo Go once and record the actual result, which is expected to stay empty until the runtime is a dev client.

Fixtures used before, generated with `edge-tts`:

- Voice `zh-HK-HiuMaanNeural`, text `我今日好攰，唔想做功課，想休息一下。` Expect the transcript to contain `攰` and `功課`.
- Voice `en-HK-YanNeural`, text `I feel tired and I do not want to do my homework.` Expect `tired` and `home work` or `homework`.

On web, feed the audio by replacing `getUserMedia` and stub `SpeechRecognition`, so a pass cannot come from live dictation. On native, play or inject the same files into the recorder, or call `transcribeRecording` on the fixture file directly and then check the note box in the UI.

Also confirm:

- An empty or silent recording does not fill the box with Whisper hallucinations such as “thanks for watching”.
- Editing the box during transcription is not overwritten.
- `npm test` and `npm run typecheck` in `unfold/` still pass.

## Files

- `unfold/src/transcribeAudio.ts` — web Whisper. Extend here, or split a native implementation behind the same export.
- `unfold/src/speech.ts` — browser live preview only.
- `unfold/src/useVoiceCapture.ts` — stop returns `{ transcript, audioUri }`.
- `unfold/app/index.tsx` — stages the recording and opens `/write`.
- `unfold/app/write.tsx` — fills the note box.
- `unfold/src/recordingDraft.ts` — in-memory handoff into the note page.
- `unfold/src/lib/transcriptText.ts` — `readTranscript` and `nextComposerText`.
- `unfold/src/lib/organise.ts` — persists `file:` and `content:` audio only.
- `unfold/app.json` — `expo-audio` plugin. A dev client will need `expo-dev-client` and a prebuild.
