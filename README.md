# Unfold

A private voice diary for students. Record on your phone, then decide whether a de-identified summary can be shared with a social worker.

The app is an Expo project in `unfold/`.

```bash
cd unfold
npm install
npm test
npm run web
```

Voice notes are transcribed with [ElevenLabs Scribe v2](https://elevenlabs.io/docs/api-reference/speech-to-text/convert). Put your API key in `unfold/.env.local` (gitignored) before starting the dev server:

```bash
EXPO_PUBLIC_ELEVENLABS_API_KEY=sk_...
```

`npm start` opens the Expo dev server for Android, iOS, or web. Recordings are sent to ElevenLabs only to be transcribed; voice notes and transcripts are saved on the device. A short summary is prepared only if you ask, and it is shared only after you approve it.
