/**
 * useSilenceTimer Hook - Unit Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useSilenceTimer, UseSilenceTimerOptions } from '../useSilenceTimer';

// Mock console.log to reduce test output noise
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useSilenceTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const defaultOptions: UseSilenceTimerOptions = {
    enabled: true,
    timeoutSeconds: 10,
    isAIPlaying: false,
    isUserSpeaking: false,
    isProcessing: false,
    onTimeout: jest.fn(),
  };

  it('should initialize with elapsedTime = 0', () => {
    const { result } = renderHook(() => useSilenceTimer(defaultOptions));

    expect(result.current.elapsedTime).toBe(0);
  });

  it('should start timer after grace period (1 second)', async () => {
    const { result } = renderHook(() => useSilenceTimer(defaultOptions));

    // Initially, elapsedTime should be 0
    expect(result.current.elapsedTime).toBe(0);

    // Advance by grace period (1000ms)
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Timer should start after grace period
    // Advance by 2 seconds
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // elapsedTime should be 2 seconds
    await waitFor(() => {
      expect(result.current.elapsedTime).toBe(2);
    });
  });

  it('should call onTimeout when timeout is reached', async () => {
    const onTimeout = jest.fn();
    const { result } = renderHook(() =>
      useSilenceTimer({
        ...defaultOptions,
        timeoutSeconds: 5,
        onTimeout,
      })
    );

    // Advance by grace period (1000ms)
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Advance by timeout duration (5000ms)
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // onTimeout should be called
    await waitFor(() => {
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    // Timer should be reset after timeout
    expect(result.current.elapsedTime).toBe(0);
  });

  it('should stop timer when isAIPlaying becomes true', () => {
    const { result, rerender } = renderHook(
      ({ options }) => useSilenceTimer(options),
      {
        initialProps: { options: defaultOptions },
      }
    );

    // Advance by grace period and some time
    act(() => {
      jest.advanceTimersByTime(1000 + 3000);
    });

    // Timer should have started
    expect(result.current.elapsedTime).toBeGreaterThan(0);

    // Set isAIPlaying to true
    rerender({
      options: {
        ...defaultOptions,
        isAIPlaying: true,
      },
    });

    // Timer should be reset
    expect(result.current.elapsedTime).toBe(0);

    // Advance time further
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // elapsedTime should still be 0 (timer stopped)
    expect(result.current.elapsedTime).toBe(0);
  });

  it('should stop timer when isUserSpeaking becomes true', () => {
    const { result, rerender } = renderHook(
      ({ options }) => useSilenceTimer(options),
      {
        initialProps: { options: defaultOptions },
      }
    );

    // Advance by grace period and some time
    act(() => {
      jest.advanceTimersByTime(1000 + 3000);
    });

    // Timer should have started
    expect(result.current.elapsedTime).toBeGreaterThan(0);

    // Set isUserSpeaking to true
    rerender({
      options: {
        ...defaultOptions,
        isUserSpeaking: true,
      },
    });

    // Timer should be reset
    expect(result.current.elapsedTime).toBe(0);

    // Advance time further
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // elapsedTime should still be 0 (timer stopped)
    expect(result.current.elapsedTime).toBe(0);
  });

  it('should stop timer when isProcessing becomes true', () => {
    const { result, rerender } = renderHook(
      ({ options }) => useSilenceTimer(options),
      {
        initialProps: { options: defaultOptions },
      }
    );

    // Advance by grace period and some time
    act(() => {
      jest.advanceTimersByTime(1000 + 3000);
    });

    // Timer should have started
    expect(result.current.elapsedTime).toBeGreaterThan(0);

    // Set isProcessing to true
    rerender({
      options: {
        ...defaultOptions,
        isProcessing: true,
      },
    });

    // Timer should be reset
    expect(result.current.elapsedTime).toBe(0);

    // Advance time further
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // elapsedTime should still be 0 (timer stopped)
    expect(result.current.elapsedTime).toBe(0);
  });

  it('should stop timer when enabled becomes false', () => {
    const { result, rerender } = renderHook(
      ({ options }) => useSilenceTimer(options),
      {
        initialProps: { options: defaultOptions },
      }
    );

    // Advance by grace period and some time
    act(() => {
      jest.advanceTimersByTime(1000 + 3000);
    });

    // Timer should have started
    expect(result.current.elapsedTime).toBeGreaterThan(0);

    // Set enabled to false
    rerender({
      options: {
        ...defaultOptions,
        enabled: false,
      },
    });

    // Timer should be reset
    expect(result.current.elapsedTime).toBe(0);

    // Advance time further
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // elapsedTime should still be 0 (timer stopped)
    expect(result.current.elapsedTime).toBe(0);
  });

  it('should reset timer when resetTimer() is called', () => {
    const { result } = renderHook(() => useSilenceTimer(defaultOptions));

    // Advance by grace period and some time
    act(() => {
      jest.advanceTimersByTime(1000 + 3000);
    });

    // Timer should have started
    expect(result.current.elapsedTime).toBeGreaterThan(0);

    // Call resetTimer
    act(() => {
      result.current.resetTimer();
    });

    // Timer should be reset
    expect(result.current.elapsedTime).toBe(0);
  });

  it('should restart timer when stop conditions are removed', () => {
    const { result, rerender } = renderHook(
      ({ options }) => useSilenceTimer(options),
      {
        initialProps: {
          options: {
            ...defaultOptions,
            isAIPlaying: true, // Initially AI is playing
          },
        },
      }
    );

    // Advance time
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Timer should not have started (AI is playing)
    expect(result.current.elapsedTime).toBe(0);

    // Stop AI playback
    rerender({
      options: {
        ...defaultOptions,
        isAIPlaying: false,
      },
    });

    // Advance by grace period and some time
    act(() => {
      jest.advanceTimersByTime(1000 + 2000);
    });

    // Timer should have started
    expect(result.current.elapsedTime).toBeGreaterThan(0);
  });

  it('should reset timer when timeoutSeconds changes', () => {
    const { result, rerender } = renderHook(
      ({ options }) => useSilenceTimer(options),
      {
        initialProps: { options: defaultOptions },
      }
    );

    // Advance by grace period and some time
    act(() => {
      jest.advanceTimersByTime(1000 + 3000);
    });

    // Timer should have started
    expect(result.current.elapsedTime).toBeGreaterThan(0);

    // Change timeoutSeconds
    rerender({
      options: {
        ...defaultOptions,
        timeoutSeconds: 20, // Changed from 10 to 20
      },
    });

    // Timer should be reset
    expect(result.current.elapsedTime).toBe(0);
  });

  it('should cleanup timers on unmount', () => {
    const { result, unmount } = renderHook(() => useSilenceTimer(defaultOptions));

    // Advance by grace period and some time
    act(() => {
      jest.advanceTimersByTime(1000 + 3000);
    });

    // Timer should have started
    expect(result.current.elapsedTime).toBeGreaterThan(0);

    // Unmount
    unmount();

    // Advance time after unmount
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // No errors should occur (cleanup successful)
  });

  it('should not call onTimeout if timer is reset before timeout', async () => {
    const onTimeout = jest.fn();
    const { result } = renderHook(() =>
      useSilenceTimer({
        ...defaultOptions,
        timeoutSeconds: 5,
        onTimeout,
      })
    );

    // Advance by grace period and some time (but not reaching timeout)
    act(() => {
      jest.advanceTimersByTime(1000 + 3000);
    });

    // Reset timer
    act(() => {
      result.current.resetTimer();
    });

    // Advance by timeout duration
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // onTimeout should not be called (timer was reset)
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('should handle rapid state changes correctly', () => {
    const { result, rerender } = renderHook(
      ({ options }) => useSilenceTimer(options),
      {
        initialProps: { options: defaultOptions },
      }
    );

    // Rapid state changes
    act(() => {
      // AI starts playing
      rerender({
        options: {
          ...defaultOptions,
          isAIPlaying: true,
        },
      });

      // AI stops playing
      rerender({
        options: {
          ...defaultOptions,
          isAIPlaying: false,
        },
      });

      // User starts speaking
      rerender({
        options: {
          ...defaultOptions,
          isUserSpeaking: true,
        },
      });

      // User stops speaking
      rerender({
        options: {
          ...defaultOptions,
          isUserSpeaking: false,
        },
      });
    });

    // Timer should be reset
    expect(result.current.elapsedTime).toBe(0);

    // Advance by grace period and some time
    act(() => {
      jest.advanceTimersByTime(1000 + 2000);
    });

    // Timer should have started
    expect(result.current.elapsedTime).toBeGreaterThan(0);
  });
});
