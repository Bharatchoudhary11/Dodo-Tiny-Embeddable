// Chooses the demo host for the root page and the isolated checkout for #/checkout.
import Checkout from "./pages/Checkout";
import Demo from "./pages/Demo";

function App() {
  if (window.location.hash === "#/checkout") {
    return <Checkout />;
  }

  return <Demo />;
}

export default App;
