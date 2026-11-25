// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { LazyMotion, domAnimation } from 'motion/react';
import { act, mount } from '@/test/render';
import { ToastProvider } from '@/state/ToastProvider';
import { useToast, type ToastContextValue } from '@/state/toast-context';
import { Modal } from './Modal';

// motion animates in plain JS without Web Animations; happy-dom's reject on unmount.
delete (Element.prototype as Partial<Element>).animate;

const ctx: { toast?: ToastContextValue; setOpen?: (open: boolean) => void; closes: number } = { closes: 0 };

function Harness() {
  const [open, setOpen] = useState(false);
  ctx.toast = useToast();
  ctx.setOpen = setOpen;
  return (
    <Modal
      open={open}
      onClose={() => {
        ctx.closes += 1;
        setOpen(false);
      }}
      title="Settings"
      description="Small knobs."
    >
      <button type="button">Inside</button>
    </Modal>
  );
}

let unmount: (() => void) | undefined;
const dialog = () => document.querySelector('dialog');

afterEach(() => {
  unmount?.();
  vi.useRealTimers();
  ctx.closes = 0;
});

describe('Modal — a native modal dialog', () => {
  it('opens with showModal, named by its title, and Escape asks the app to close it', async () => {
    vi.useFakeTimers();
    ({ unmount } = mount(
      <LazyMotion features={domAnimation}>
        <ToastProvider>
          <Harness />
        </ToastProvider>
      </LazyMotion>,
    ));
    expect(dialog()).toBeNull();

    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    act(() => ctx.setOpen!(true));
    const el = dialog()!;
    expect(el.open).toBe(true);
    expect(showModal).toHaveBeenCalledTimes(1); // modal, not show(): the page behind goes inert
    showModal.mockRestore();
    expect(document.getElementById(el.getAttribute('aria-labelledby')!)?.textContent).toBe('Settings');
    expect(el.querySelector('[role=dialog], [aria-modal]')).toBeNull(); // the native element provides both

    // Escape fires `cancel`: the app closes it (so the exit can animate), not the browser.
    const cancel = new Event('cancel', { cancelable: true });
    act(() => void el.dispatchEvent(cancel));
    expect(cancel.defaultPrevented).toBe(true);
    expect(ctx.closes).toBe(1);
    vi.useRealTimers(); // the exit animation runs on animation frames, which fake timers don't drive
    await act(() => new Promise((done) => setTimeout(done, 1500)));
    expect(dialog()).toBeNull();
    expect(ctx.closes).toBe(1); // closing it on unmount isn't reported back as a second close
  });

  it('shows feedback from while it is open, not from before', async () => {
    vi.useFakeTimers();
    ({ unmount } = mount(
      <LazyMotion features={domAnimation}>
        <ToastProvider>
          <Harness />
        </ToastProvider>
      </LazyMotion>,
    ));
    act(() => ctx.toast!.push('Switched to Metro'));
    act(() => ctx.setOpen!(true));
    const status = () => dialog()!.querySelector('[role=status]')!;
    expect(status().textContent).toBe('');

    act(() => ctx.toast!.push('Link copied.'));
    expect(status().textContent).toBe('Link copied.');
  });
});
