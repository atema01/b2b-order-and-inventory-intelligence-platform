import { useEffect } from 'react';

export const useRealtimeEvent = <T = any>(
  eventName: string,
  handler: (detail: T) => void
) => {
  useEffect(() => {
    const listener = (event: Event) => {
      handler((event as CustomEvent<T>).detail);
    };

    window.addEventListener(eventName, listener);
    return () => window.removeEventListener(eventName, listener);
  }, [eventName, handler]);
};
