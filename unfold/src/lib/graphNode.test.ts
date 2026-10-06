import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GraphNode } from '../components/graphNode.web';

test('web graph nodes render accessible SVG groups without native responder handlers', () => {
  const node = GraphNode({ label: 'Topic Coursework, filter notes', onPress: () => undefined, children: null });
  assert.equal(node.type, 'g');
  assert.equal(node.props.role, 'button');
  assert.equal(node.props.tabIndex, 0);
  assert.equal(node.props.onPress, undefined);
  assert.deepEqual(Object.keys(node.props).filter((key) => key.startsWith('on')), ['onClick', 'onKeyDown']);
  const markup = renderToStaticMarkup(createElement('svg', null, node));
  assert.match(markup, /<g role="button" aria-label="Topic Coursework, filter notes" tabindex="0"/);
});

test('web graph nodes activate on click, Enter and Space, but not unrelated or repeated keys', () => {
  let activations = 0;
  let prevented = 0;
  const node = GraphNode({ label: 'Note', onPress: () => { activations += 1; }, children: null });
  node.props.onClick();
  assert.equal(activations, 1);

  for (const key of ['Enter', ' ']) {
    node.props.onKeyDown({ key, repeat: false, preventDefault: () => { prevented += 1; } });
  }
  assert.equal(activations, 3);
  assert.equal(prevented, 2);

  node.props.onKeyDown({ key: 'ArrowDown', repeat: false, preventDefault: () => { prevented += 1; } });
  node.props.onKeyDown({ key: 'Enter', repeat: true, preventDefault: () => { prevented += 1; } });
  assert.equal(activations, 3);
  assert.equal(prevented, 3);
});
