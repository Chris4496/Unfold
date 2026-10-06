import type { GraphBackdropProps, GraphNodeProps } from './graphNode';

/** Use DOM events on web so native SVG responder props never reach the DOM. */
export function GraphNode({ children, label, onPress }: GraphNodeProps) {
  return (
    <g
      role="button"
      aria-label={label}
      tabIndex={0}
      style={{ cursor: 'pointer' }}
      onClick={onPress}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (!event.repeat) onPress();
        }
      }}
    >
      {children}
    </g>
  );
}

export function GraphBackdrop({ width, height, onPress }: GraphBackdropProps) {
  return <rect x={0} y={0} width={width} height={height} fill="#FFFFFF" fillOpacity={0} onClick={onPress} />;
}
