import { useEffect, useRef, useState } from 'react';

// Counts down from the number of seconds the SERVER reports (so a wrong clock on the visitor's computer cannot cheat)
export default function useCountdown(secondsLeft, onEnd) {
  const [left, setLeft] = useState(secondsLeft ?? 0);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    if (secondsLeft === null || secondsLeft === undefined) return undefined;
    const endAt = Date.now() + secondsLeft * 1000;
    let timer = null;
    const tick = () => {
      const s = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) { if (timer) clearInterval(timer); endRef.current?.(); }
    };
    tick();
    timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  return {
    left,
    d: Math.floor(left / 86400),
    h: Math.floor((left % 86400) / 3600),
    m: Math.floor((left % 3600) / 60),
    s: left % 60,
  };
}
