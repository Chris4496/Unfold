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

> **Known issue: the API key is exposed in the app.** Expo inlines every `EXPO_PUBLIC_*` variable into the JavaScript bundle. Anyone with a copy of the app or the web build can extract the key and spend the account's ElevenLabs credits. This is fine for local development and demos, but not for a public release. Before shipping, move the speech-to-text call behind a small backend that holds the key, and have the app send recordings there. Until then, use a key restricted to speech-to-text with a low usage limit, and rotate it if a build is shared.

`npm start` opens the Expo dev server for Android, iOS, or web. Recordings are sent to ElevenLabs only to be transcribed; voice notes and transcripts are saved on the device. A short summary is prepared only if you ask, and it is shared only after you approve it.
