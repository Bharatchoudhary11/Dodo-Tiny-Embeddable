import Checkout from "./pages/Checkout";

function App() {
  if (window.location.hash === "#/checkout") {
    return <Checkout />;
  }

  return (
    <main className="milestone-page">
      <p className="eyebrow">Tiny Embeddable Checkout</p>
      <h1>Part 2: Checkout app</h1>
      <p className="intro">
        The SDK foundation and isolated checkout iframe are ready. The demo
        host will be added in the final part.
      </p>
      <div className="milestones" aria-label="Project milestones">
        <div className="milestone milestone-complete">
          <span>01</span>
          <div>
            <strong>SDK script</strong>
            <p>Expose DodoCheckout.open() from one drop-in TypeScript file.</p>
          </div>
        </div>
        <div className="milestone milestone-complete">
          <span>02</span>
          <div>
            <strong>Checkout app</strong>
            <p>Build the isolated payment experience inside the iframe.</p>
          </div>
        </div>
        <div className="milestone">
          <span>03</span>
          <div>
            <strong>Demo site</strong>
            <p>Show the integration and callback events on a host page.</p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
