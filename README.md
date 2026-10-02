# Unfold

A private voice diary for students. Record on your phone, then decide whether a de-identified summary can be shared with a social worker.

The app is an Expo project in `unfold/`.

```bash
cd unfold
npm install
npm test
npm run web
```

`npm start` opens the Expo dev server for Android, iOS, or web. Voice notes and transcripts stay on the device. A short summary is prepared only if you ask, and it is shared only after you approve it.

## Turning recordings into text

After a recording stops, the app transcribes it on the device and puts the text in the **What did you want to say?** box. Cantonese and English both work. The recording is never uploaded.

- **Browser:** runs `whisper-small-cantonese` through WebAssembly.
- **iPhone and Android:** runs the GGML build of the same model through `whisper.rn`. The first transcription downloads the model (about 490 MB) and keeps it on the phone.

Phones need the Unfold app build, either a development build or a release build:

```bash
cd unfold
npm run android   # or: npm run ios
npm start         # then open the installed Unfold app, not Expo Go
```

Expo Go cannot transcribe. It does not include the native speech engine, so after a recording the note box stays empty and you type the note yourself.
