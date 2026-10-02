# Unfold

A private voice diary for students. Record on your phone, then decide whether a de-identified summary can be shared with a social worker.

The app is an Expo project in `unfold/`.

```bash
cd unfold
npm install
npm test
npm run web
```

`npm start` opens the Expo dev server for Android, iOS, or web. Recordings are transcribed with ElevenLabs Scribe v2. Voice notes and transcripts are then saved on the device. A short summary is prepared only if you ask, and it is shared only after you approve it.

Set `EXPO_PUBLIC_ELEVENLABS_API_KEY` in `unfold/.env` if you want to use a different Speech to Text key.
