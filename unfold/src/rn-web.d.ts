import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    /** Web-only data attributes. React Native Web forwards these as data-* props. */
    dataSet?: Record<string, string>;
  }
}
