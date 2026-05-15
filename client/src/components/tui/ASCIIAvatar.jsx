import { useEffect, useMemo, useRef, useState } from 'react';
import { generateFace } from '../../utils/asciiFace';

/**
 * Deterministic ASCII-face avatar for a username.
 *
 * On hover the face "animates" — eyes + mouth cycle through
 * expression variants, then settle back when the pointer leaves.
 *
 *   <ASCIIAvatar username="john" size={8} />
 *
 * @param {string}  username   drives the deterministic face
 * @param {number}  [size=8]   inner grid side length (chars)
 * @param {boolean} [animate]  enable hover animation (default true)
 * @param {boolean} [glow]     phosphor text-glow (default true)
 * @param {string}  [className]
 */
export default function ASCIIAvatar({
  username = '',
  size = 8,
  animate = true,
  glow = true,
  className = '',
}) {
  // Pre-render the 4 expression variants once per username/size.
  const frames = useMemo(
    () => [0, 1, 2, 3].map((e) => generateFace(username, size, e).join('\n')),
    [username, size]
  );

  const [frame, setFrame] = useState(0);
  const timer = useRef(null);

  const stop = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  const start = () => {
    if (!animate || timer.current) return;
    timer.current = setInterval(
      () => setFrame((f) => (f + 1) % frames.length),
      170
    );
  };

  // Clear the timer if the component unmounts mid-animation.
  useEffect(() => stop, []);

  return (
    <pre
      title={username}
      onMouseEnter={start}
      onMouseLeave={() => {
        stop();
        setFrame(0);
      }}
      className={`inline-block m-0 leading-[1.05] whitespace-pre select-none cursor-default text-fg ${
        glow ? 'glow' : ''
      } ${className}`}
      style={{ fontSize: 'inherit' }}
    >
      {frames[frame]}
    </pre>
  );
}
