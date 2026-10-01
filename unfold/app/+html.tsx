import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Unfold</title>
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                height: 100%;
                min-height: 100dvh;
                background: #E7F1EE;
                margin: 0;
              }
              body { overflow: hidden; }
              #root { display: flex; flex-direction: column; }
              /* Percentage heights collapse inside the navigator, so pin the app
                 to the viewport and stretch the phone column to that box. */
              #unfold-app {
                position: fixed !important;
                inset: 0 !important;
                display: flex !important;
                flex-direction: column !important;
                width: 100% !important;
                height: 100dvh !important;
                min-height: 100dvh !important;
              }
              [data-unfold-screen] {
                flex: 1 1 auto !important;
                width: 100% !important;
                height: 100% !important;
                min-height: 100% !important;
              }
              [data-unfold-frame] {
                flex: 1 1 auto !important;
                width: 100% !important;
                max-width: 440px !important;
                height: 100% !important;
                min-height: 100% !important;
                margin-left: auto !important;
                margin-right: auto !important;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
