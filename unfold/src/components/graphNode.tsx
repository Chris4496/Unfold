import type { ReactNode } from 'react';
import { G } from 'react-native-svg';

export type GraphNodeProps = {
  children: ReactNode;
  label: string;
  onPress: () => void;
};

/** Native SVG nodes retain the platform's touch responder handling. */
export function GraphNode({ children, label, onPress }: GraphNodeProps) {
  return (
    <G accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {children}
    </G>
  );
}
