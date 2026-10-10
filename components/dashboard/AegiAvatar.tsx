"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tag } from "@/components/ui/Tag";

// Character SVG only, from dashboard-revamp/aegi-markup.html, pasted
// verbatim (purely decorative, aria-hidden, no interactive content inside
// it) - everything structural (.ai-wrap/.ai-girl/.ai-msgs, classes and ids)
// is rendered as real JSX below so this component can drive it directly.
const GIRL_SVG = `
<svg width="190" height="226" viewBox="0 0 160 190" aria-hidden="true" style="overflow:visible">
<defs>
<linearGradient id="aiHair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A66C0"></stop><stop offset="1" stop-color="#123C78"></stop></linearGradient>
<linearGradient id="aiIris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B6FC8"></stop><stop offset=".6" stop-color="#3DA5E0"></stop><stop offset="1" stop-color="#9BE1FF"></stop></linearGradient>
</defs>
<g class="ai-sway">
<path class="ai-tailL" d="M34 70 C10 80 2 120 14 160 C20 150 24 140 26 126 C30 110 36 96 44 84Z" fill="url(#aiHair)"></path>
<path class="ai-tailR" d="M126 70 C150 80 158 120 146 160 C140 150 136 140 134 126 C130 110 124 96 116 84Z" fill="url(#aiHair)"></path>
<path d="M80 14 C42 14 22 44 22 84 C22 118 30 146 44 166 L116 166 C130 146 138 118 138 84 C138 44 118 14 80 14Z" fill="url(#aiHair)"></path>
<path d="M46 160 Q80 142 114 160 L124 192 L36 192Z" fill="#FFFFFF" stroke="#CFE0F0" stroke-width="2" stroke-linejoin="round"></path>
<rect x="72" y="136" width="16" height="22" rx="6" fill="#F6D2BE"></rect>
<path d="M64 156 L80 172 L96 156 L90 152 L80 162 L70 152Z" fill="#0C4B87"></path>
<path d="M80 176 C86 176 92 178 94 180 C94 188 88 192 80 194 C72 192 66 188 66 180 C68 178 74 176 80 176Z" fill="#3DA5E0" stroke="#FFFFFF" stroke-width="1.5" transform="translate(0,-2) scale(1)"></path>
<path d="M34 84 C34 52 54 40 80 40 C106 40 126 52 126 84 C126 116 108 140 80 142 C52 140 34 116 34 84Z" fill="#FFE6D8"></path>
<path d="M34 84 C36 108 50 128 66 138 C52 130 40 112 36 92Z" fill="#F6CDB8" fill-opacity=".6"></path>
<g class="ai-eye"><ellipse cx="59" cy="94" rx="12" ry="15" fill="#FFFFFF"></ellipse><ellipse cx="57" cy="95" rx="9.6" ry="12.8" fill="url(#aiIris)"></ellipse><ellipse cx="56.2" cy="96" rx="5" ry="7.4" fill="#0A2540"></ellipse><circle cx="52.5" cy="89.5" r="3.4" fill="#FFFFFF"></circle><circle cx="60" cy="101" r="1.7" fill="#FFFFFF"></circle><path d="M45 87 C48 77 66 76 72 86" stroke="#0A2540" stroke-width="3.4" stroke-linecap="round" fill="none"></path><path d="M45 87 L41 84" stroke="#0A2540" stroke-width="2.6" stroke-linecap="round"></path></g>
<g class="ai-eye"><ellipse cx="101" cy="94" rx="12" ry="15" fill="#FFFFFF"></ellipse><ellipse cx="99" cy="95" rx="9.6" ry="12.8" fill="url(#aiIris)"></ellipse><ellipse cx="98.2" cy="96" rx="5" ry="7.4" fill="#0A2540"></ellipse><circle cx="94.5" cy="89.5" r="3.4" fill="#FFFFFF"></circle><circle cx="102" cy="101" r="1.7" fill="#FFFFFF"></circle><path d="M88 86 C94 76 112 77 115 87" stroke="#0A2540" stroke-width="3.4" stroke-linecap="round" fill="none"></path><path d="M115 87 L119 84" stroke="#0A2540" stroke-width="2.6" stroke-linecap="round"></path></g>
<path d="M50 72 Q58 68 66 71" stroke="#123C78" stroke-width="2.2" stroke-linecap="round" fill="none"></path>
<path d="M94 71 Q102 68 110 72" stroke="#123C78" stroke-width="2.2" stroke-linecap="round" fill="none"></path>
<ellipse cx="46" cy="116" rx="8" ry="4.6" fill="#FF8FA8" fill-opacity=".5"></ellipse>
<ellipse cx="114" cy="116" rx="8" ry="4.6" fill="#FF8FA8" fill-opacity=".5"></ellipse>
<path d="M80 108 L78.5 111 L81.5 111Z" fill="#E7B7A0"></path>
<path class="ai-smile" d="M70 120 Q80 130 90 120" stroke="#B5475E" stroke-width="2.6" stroke-linecap="round" fill="none"></path>
<g class="ai-mo"><ellipse cx="80" cy="123" rx="7" ry="6" fill="#8E2F47"></ellipse><ellipse cx="80" cy="126" rx="4" ry="2.4" fill="#F28FA2"></ellipse></g>
<path d="M28 84 C24 44 50 20 80 20 C110 20 136 44 132 84 C128 66 122 56 112 52 C104 64 92 68 80 56 C68 68 56 64 48 52 C38 56 32 66 28 84Z" fill="url(#aiHair)"></path>
<path d="M44 40 C54 30 66 26 78 26" stroke="#7DB9FF" stroke-opacity=".7" stroke-width="3" stroke-linecap="round" fill="none"></path>
<path d="M30 86 C28 104 30 124 38 140 C40 124 40 108 38 92Z" fill="url(#aiHair)"></path>
<path d="M130 86 C132 104 130 124 122 140 C120 124 120 108 122 92Z" fill="url(#aiHair)"></path>
<path class="ai-ahoge" d="M80 21 C74 6 90 -2 98 8" stroke="#2A66C0" stroke-width="4.5" stroke-linecap="round" fill="none"></path>
<path d="M116 40 C122 38 128 42 128 48 C128 56 122 60 116 62 C110 60 104 56 104 48 C104 42 110 38 116 40Z" fill="#3DA5E0" stroke="#FFFFFF" stroke-width="2" transform="translate(0,-4) scale(.8) translate(26,6)"></path>
<path class="ai-sparkle" d="M20 40 L22 46 L28 48 L22 50 L20 56 L18 50 L12 48 L18 46Z" fill="#9BE1FF"></path>
</g>
<g class="ai-handwrap"><g class="ai-hand"><path d="M30 190 C26 176 26 160 32 150 C34 146 40 148 40 153 L40 164 L44 148 C45 144 51 145 50 150 L48 166 L54 154 C56 150 61 152 60 156 L54 176 L52 190Z" fill="#FFE6D8" stroke="#F0C5AE" stroke-width="1.5" stroke-linejoin="round"></path></g></g>
</svg>
`;

function lines(pending: number): string[] {
  return [
    "Hi! I’m Aegi. I keep watch over your hospital’s stock.",
    pending > 0
      ? `While you were away I checked every item and drafted ${pending} purchase order${pending === 1 ? "" : "s"} for you.`
      : "While you were away I checked every item. All purchase orders are handled.",
    pending > 0
      ? "Nothing goes to a supplier until you approve it. Want to take a look?"
      : "Everything looks calm for now.",
  ];
}

// Intro timeline (ms from mount), matching the brief's choreography but with
// a shorter auto-collapse than the original ~17s hold: she only plays the
// typed-out, one-by-one reveal on this first run. After that she rests
// tucked at the edge and only expands (instantly, no re-typing) on hover,
// collapsing again the moment the mouse leaves.
const APPEAR_AT = 700; // jumps out from the edge
const TYPE1_AT = 2200;
const MSG1_AT = 3500;
const TYPE2_AT = 4600;
const MSG2_AT = 6000;
const TYPE3_AT = 7100;
const MSG3_AT = 8600;
const COLLAPSE_AT = MSG3_AT + 4000; // hold the last message a few seconds, then fade
const TUCK_AT = COLLAPSE_AT + 900; // then slide back to the edge

type Beat = { at: number; run: () => void };

declare global {
  interface Window {
    __aegiIntroPlayed?: boolean;
  }
}

// Stored on `window`, not as component or module state: a plain module-level
// variable isn't reliable here because Next's client-side router can evict
// and re-fetch a route's JS (re-running this module from scratch) when you
// navigate away and back, which defeated an earlier attempt at this. `window`
// itself is the one thing guaranteed to survive for as long as the tab does,
// and only a true reload (soft or hard) ever recreates it - exactly the
// "only replay on a real refresh" behavior asked for.
function hasPlayedIntroThisPageLoad(): boolean {
  return typeof window !== "undefined" && window.__aegiIntroPlayed === true;
}
function markIntroPlayed() {
  if (typeof window !== "undefined") window.__aegiIntroPlayed = true;
}

export function AegiAvatar({
  pending,
  sample,
  reviewHref,
}: {
  pending: number;
  sample: boolean;
  reviewHref: string;
}) {
  const [dismissed, setDismissed] = React.useState(false);
  const [playingIntro, setPlayingIntro] = React.useState(() => !hasPlayedIntroThisPageLoad());
  const [appeared, setAppeared] = React.useState(false); // past the 700ms jump-out
  const [hovering, setHovering] = React.useState(false);
  const [bubbleCount, setBubbleCount] = React.useState(0);
  const [typing, setTyping] = React.useState(false);
  const [talking, setTalking] = React.useState(false);

  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const hoverLeaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deliberately no "already ran" guard: in production this effect only
  // ever runs once anyway (mount-once, empty deps). In dev, React Strict
  // Mode runs setup -> cleanup -> setup once to catch missing cleanups; a
  // guard here would let the cleanup cancel the real timers and then block
  // the second (real) setup from ever rescheduling them, leaving her stuck
  // in her pre-animation state forever - which is exactly what happened.
  React.useEffect(() => {
    // Already played earlier this page load (this is a client-side nav back
    // to the Dashboard, not a fresh load): rest tucked, ready for hover,
    // skip the whole intro.
    if (!playingIntro) return;
    markIntroPlayed();

    const activeTimers: ReturnType<typeof setTimeout>[] = [];
    timers.current = activeTimers;
    const after = (ms: number, run: () => void) => activeTimers.push(setTimeout(run, ms));

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      // No bobbing/typing/bubble-throw: she and the messages simply appear,
      // then tuck away.
      after(0, () => {
        setAppeared(true);
        setBubbleCount(3);
      });
      after(TUCK_AT, () => setPlayingIntro(false));
      return () => activeTimers.forEach(clearTimeout);
    }

    const flashTalk = () => {
      setTalking(true);
      after(1200, () => setTalking(false));
    };

    const beats: Beat[] = [
      { at: APPEAR_AT, run: () => setAppeared(true) },
      { at: TYPE1_AT, run: () => setTyping(true) },
      {
        at: MSG1_AT,
        run: () => {
          setTyping(false);
          setBubbleCount(1);
          flashTalk();
        },
      },
      { at: TYPE2_AT, run: () => setTyping(true) },
      {
        at: MSG2_AT,
        run: () => {
          setTyping(false);
          setBubbleCount(2);
          flashTalk();
        },
      },
      { at: TYPE3_AT, run: () => setTyping(true) },
      {
        at: MSG3_AT,
        run: () => {
          setTyping(false);
          setBubbleCount(3);
          flashTalk();
        },
      },
      { at: COLLAPSE_AT, run: () => setBubbleCount(0) },
      { at: TUCK_AT, run: () => setPlayingIntro(false) },
    ];

    beats.forEach((b) => after(b.at, b.run));

    return () => activeTimers.forEach(clearTimeout);
    // Only the mount-time value of playingIntro matters here (whether this
    // particular mount should play the intro at all); it's never meant to
    // re-run when playingIntro later flips to false at the end of the intro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    timers.current.forEach(clearTimeout);
    if (hoverLeaveTimer.current) clearTimeout(hoverLeaveTimer.current);
    setDismissed(true);
  }

  function onEnter() {
    if (playingIntro || dismissed) return;
    if (hoverLeaveTimer.current) clearTimeout(hoverLeaveTimer.current);
    setHovering(true);
    setBubbleCount(3);
  }
  function onLeave() {
    if (playingIntro || dismissed) return;
    hoverLeaveTimer.current = setTimeout(() => {
      setHovering(false);
      setBubbleCount(0);
    }, 150);
  }

  if (dismissed) return null;

  const out = playingIntro ? appeared : hovering;
  const peeked = !playingIntro && !hovering;
  const msgs = lines(pending);
  const showMsgs = bubbleCount > 0 || typing;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags -- public/aegi/aegi.css is
          a static third-party stylesheet that must load only on this route;
          React 19 hoists this into <head>. */}
      <link rel="stylesheet" href="/aegi/aegi.css" />
      {/* Shrinks the whole character+bubble stack from the provided
          190x226px size, from a single scale transform so nothing inside
          aegi.css needs editing. */}
      <style>{`.ai-wrap{transform:scale(.68);transform-origin:bottom right}.ai-close-btn{z-index:151}.ai-bub.ai-typing{padding:18px 24px}`}</style>

      <div
        className="ai-wrap"
        aria-hidden="true"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <div
          id="aegiGirl"
          className={cn("ai-girl", out && "ai-out", peeked && "ai-peek", talking && "ai-talk")}
          dangerouslySetInnerHTML={{ __html: GIRL_SVG }}
        />
      </div>

      <div
        id="aegiMsgs"
        className={cn("ai-msgs", !showMsgs && "ai-msgs-off")}
        aria-live="polite"
        role="status"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {msgs.slice(0, bubbleCount).map((text, i) => (
          <div key={i} className="ai-bub">
            <div>{text}</div>
            {i === 2 && pending > 0 ? (
              <div className="mt-2.5 flex items-center gap-2.5">
                <a className="ai-cta" href={reviewHref}>
                  Review now
                </a>
                {sample ? <Tag tone="dashed">Sample data</Tag> : null}
              </div>
            ) : null}
          </div>
        ))}
        {typing ? (
          <div className="ai-bub ai-typing">
            <span className="ai-dots">
              <i />
              <i />
              <i />
            </span>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss Aegi"
        className="ai-close-btn fixed right-2 bottom-60 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-muted shadow-sm transition-colors duration-150 hover:bg-page hover:text-ink focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </>
  );
}
