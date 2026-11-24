import { render, type ComponentChildren } from 'preact';
import { act } from 'preact/test-utils';

/*
 * Test helpers for files that opt into the simulated browser with
 * `// @vitest-environment happy-dom`. Preact's own `act` flushes effects and
 * state updates, so no testing library is needed.
 */

/** Runs a hook inside a mounted component; `result.current` is its latest return value. */
export function renderHook<T>(hook: () => T) {
  const result = { current: undefined as T };
  const container = document.createElement('div');
  function Probe() {
    result.current = hook();
    return null;
  }
  act(() => render(<Probe />, container));
  return {
    result,
    rerender: () => act(() => render(<Probe />, container)),
    unmount: () => act(() => render(null, container)),
  };
}

/** Mounts a tree into the document, so effects and event listeners run as on the page. */
export function mount(tree: ComponentChildren) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => render(tree, container));
  return {
    container,
    unmount: () => {
      act(() => render(null, container));
      container.remove();
    },
  };
}

export { act };
