"use client";

import { useCallback, useState } from "react";

export default function Home() {
  const [run, setRun] = useState(0);
  const replay = useCallback(() => setRun((value) => value + 1), []);

  return (
    <main className="splash" key={run}>
      <div className="brand-stage" aria-hidden="true">
        <img className="brand-full" src="/spiora-logo-vector.svg?v=46" alt="" />
        <img className="brand-power" src="/spiora-power-only.svg?v=46" alt="" />
      </div>

      <div className="wave-crop" aria-hidden="true">
        <img src="/spiora-brandbook.png" alt="" />
        <span className="wave-glint" />
      </div>

      <span className="screen-reader-text">SPIORA</span>
      <button className="screen-replay" onClick={replay} aria-label="Повторить заставку" />
      <button className="replay" onClick={replay} aria-label="Повторить анимацию">↻</button>
    </main>
  );
}
