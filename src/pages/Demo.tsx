// Demo host: presents the product, opens the SDK checkout, and displays callback events.
import { useEffect, useRef, useState, type PointerEvent } from "react";
import "../../public/sdk/dodo-checkout.ts";

type EventType = "call" | "state" | "success" | "error" | "close";

type LogEntry = {
  id: string;
  type: EventType;
  name: string;
  detail: string;
  time: string;
};

type CursorPosition = {
  x: number;
  y: number;
  visible: boolean;
};

const heroDescription = "A tiny embeddable checkout that works on any website. Secure by design, beautiful by default.";

function Demo() {
  // The demo host owns the Buy Now action and records SDK callbacks here.
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [typedDescription, setTypedDescription] = useState("");
  const nextId = useRef(1);
  const [cursor, setCursor] = useState<CursorPosition>({ x: 0, y: 0, visible: false });

  useEffect(() => {
    document.title = "Dodo Payments - Demo";
  }, []);

  useEffect(() => {
    // The hero copy types in after the host page mounts.
    let characterIndex = 0;
    const timer = window.setInterval(() => {
      characterIndex += 1;
      setTypedDescription(heroDescription.slice(0, characterIndex));
      if (characterIndex === heroDescription.length) window.clearInterval(timer);
    }, 90);

    return () => window.clearInterval(timer);
  }, []);

  function addLog(type: EventType, name: string, detail: string): void {
    const id = `${Date.now()}-${nextId.current++}`;
    setLogs((current) => [
      ...current,
      {
        id,
        type,
        name,
        detail,
        time: new Date().toLocaleTimeString(),
      },
    ]);
  }

  function openCheckout(): void {
    // The SDK owns iframe isolation; this page only supplies product data and callbacks.
    if (isOpen || !window.DodoCheckout) return;

    setIsOpen(true);
    addLog("call", "DodoCheckout.open()", "productId: prod_123");
    window.DodoCheckout.open({
      productId: "prod_123",
      onSuccess: ({ sessionId }) => {
        setIsOpen(false);
        addLog("success", "onSuccess", `sessionId: ${sessionId}`);
      },
      onClose: ({ reason }) => {
        setIsOpen(false);
        addLog("close", "onClose", `reason: ${reason}`);
      },
      onError: ({ code, message }) => {
        addLog("error", "onError", `${code}: ${message}`);
      },
      onStateChange: ({ state }) => {
        addLog("state", "onStateChange", `state: ${state}`);
      },
    });
  }

  function trackCursor(event: PointerEvent<HTMLElement>): void {
    if (event.pointerType && event.pointerType !== "mouse") return;
    setCursor({ x: event.clientX, y: event.clientY, visible: true });
  }

  return (
    <main className="demo-page" onPointerMove={trackCursor} onPointerLeave={() => setCursor((current) => ({ ...current, visible: false }))}>
      <div
        className={`cursor-orbit${cursor.visible ? " cursor-orbit-visible" : ""}`}
        style={{ left: cursor.x, top: cursor.y }}
        aria-hidden="true"
      >
        <i />
        <i />
        <i />
      </div>
      <header className="demo-header">
        <div className="demo-brand">
          <span className="demo-brand-mark">D</span>
          <div>
            <strong>Dodo Payments</strong>
            <span>Embeddable checkout demo</span>
          </div>
        </div>
        <span className="demo-status">Live integration</span>
      </header>

      <section className="demo-hero">
        <div className="hero-copy">
          <span className="hero-kicker"><i /> One script. One function. That's it.</span>
          <h1>Accept payments <em>anywhere</em></h1>
          <p className="typing-description">
            {typedDescription}<span className="typing-caret" aria-hidden="true" />
          </p>
        </div>
      </section>

      <div className="demo-layout">
        <section className="store-panel">
          <div className="product-card">
            <div className="product-card-head">
              <span className="product-icon">+</span>
              <div>
                <span className="product-label">Premium</span>
                <h2>Pro Plan - Monthly</h2>
                <p>Unlock all features for your team</p>
              </div>
              <strong>$29<small>/mo</small></strong>
            </div>
            <div className="product-card-body">
              <ul className="feature-list">
                <li><b>+</b> Unlimited projects</li>
                <li><b>+</b> Priority support</li>
                <li><b>+</b> Advanced analytics</li>
                <li><b>+</b> Team collaboration</li>
              </ul>
              <button className="buy-button" type="button" onClick={openCheckout} disabled={isOpen}>
                Buy Now<span>→</span>
              </button>
            </div>
          </div>

          <div className="test-card-note">
            <strong><i /> Test Cards</strong>
            <span><code>4242 4242 4242 4242</code><b>Success</b></span>
            <span><code>4000 0000 0000 0002</code><b>Declined</b></span>
            <span><code>4000 0000 0000 0341</code><b>Retry</b></span>
          </div>
        </section>

        <aside className="demo-side">
          <section className="event-panel" aria-label="SDK callback event log">
            <div className="event-heading">
              <h2><i /> Event Log</h2>
              <button className="clear-button" type="button" onClick={() => setLogs([])} disabled={logs.length === 0}>Clear</button>
            </div>
            <div className="event-list" aria-live="polite">
              {logs.length === 0 ? (
                <div className="empty-events">
                  <span>01</span>
                  <p>Waiting for events...</p>
                  <small>Click "Buy Now" to start</small>
                </div>
              ) : logs.map((log) => (
                <div className={`event-entry event-${log.type}`} key={log.id}>
                  <span className="event-dot" />
                  <div>
                    <strong>{log.name}</strong>
                    <p>{log.detail}</p>
                  </div>
                  <time>{log.time}</time>
                </div>
              ))}
            </div>
          </section>

        </aside>
      </div>
    </main>
  );
}

export default Demo;