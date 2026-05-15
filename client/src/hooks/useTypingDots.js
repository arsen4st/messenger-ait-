import { useState, useEffect } from 'react';

/**
 * Cycles through typing animation dots: '.  ' → '.. ' → '...'
 * @param {number} intervalMs - milliseconds between frames (default 350)
 * @returns {string} current dots frame
 */
function useTypingDots(intervalMs = 350) {
  const [dots, setDots] = useState('.  ');

  useEffect(() => {
    const frames = ['.  ', '.. ', '...'];
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % frames.length;
      setDots(frames[i]);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return dots;
}

export default useTypingDots;
