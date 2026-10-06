import type { ReactNode } from 'react';
import { G, Rect } from 'react-native-svg';

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

export type GraphBackdropProps = { width: number; height: number; onPress: () => void };

/** Empty canvas behind the nodes; pressing it is how a selection is cleared. */
export function GraphBackdrop({ width, height, onPress }: GraphBackdropProps) {
  return <Rect x={0} y={0} width={width} height={height} fill="#FFFFFF" fillOpacity={0} onPress={onPress} />;
}
