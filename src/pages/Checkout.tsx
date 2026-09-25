// Isolated iframe checkout: owns payment fields, validation, fake card outcomes, and checkout state.
import { FormEvent, useEffect, useRef, useState } from "react";

type CheckoutState = "loading" | "form" | "processing" | "success";

type Product = {
  name: string;
  description: string;
  price: number;
  currency: string;
};

type ParentMessage =
  | { type: "DODO_INIT"; payload: { productId: string } }
  | { type: "DODO_CLOSE_REQUEST" };

type CheckoutMessage =
  | { type: "DODO_READY" }
  | { type: "DODO_SUCCESS"; payload: { sessionId: string } }
  | { type: "DODO_ERROR"; payload: { code: string; message: string } }
  | { type: "DODO_CLOSE"; payload: { reason: string } }
  | { type: "DODO_STATE_CHANGE"; payload: { state: string } };

const products: Record<string, Product> = {
  prod_123: {
    name: "Pro Plan - Monthly",
    description: "Unlimited projects and priority support",
    price: 2900,
    currency: "USD",
  },
  prod_456: {
    name: "Team Plan - Annual",
    description: "Advanced tools for growing teams",
    price: 19900,
    currency: "USD",
  },
};

function formatCardNumber(value: string): string {
  return value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length === 1 && Number(digits) > 1) {
    return `0${digits} / `;
  }
  if (digits.length >= 2 && Number(digits.slice(0, 2)) > 12) {
    return digits.slice(0, 1);
  }
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
}

function passesLuhn(value: string): boolean {
  let sum = 0;
  let doubleDigit = false;

  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }

  return sum % 10 === 0;
}

function createSessionId(): string {
  return `sess_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function Checkout() {
  // The checkout keeps payment fields and card outcomes inside the iframe.
  const [state, setState] = useState<CheckoutState>("loading");
  const [product, setProduct] = useState<Product>(products.prod_123);
  const [email, setEmail] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [sessionId, setSessionId] = useState("");
  const parentOrigin = useRef("*");
  const retryCount = useRef(0);

  function send(message: CheckoutMessage): void {
    if (window.parent !== window) {
      window.parent.postMessage(message, parentOrigin.current);
    }
  }

  useEffect(() => {
    // The iframe receives product data and close requests through postMessage.
    function handleMessage(event: MessageEvent<ParentMessage>): void {
      if (event.source !== window.parent) return;
      if (event.origin) parentOrigin.current = event.origin;

      if (event.data.type === "DODO_INIT") {
        setProduct(products[event.data.payload.productId] ?? products.prod_123);
        setState("form");
        send({ type: "DODO_STATE_CHANGE", payload: { state: "form" } });
      }

      if (event.data.type === "DODO_CLOSE_REQUEST") {
        send({ type: "DODO_CLOSE", payload: { reason: "user_closed" } });
      }
    }

    window.addEventListener("message", handleMessage);
    send({ type: "DODO_READY" });

    if (window.parent === window) {
      setState("form");
    }

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    // Validation happens before the fake payment delay and never exposes field values to the host.
    event.preventDefault();
    if (state === "processing") return;

    const digits = cardNumber.replace(/\D/g, "");
    const expiryDigits = expiry.replace(/\D/g, "");
    const expiryMonth = Number(expiryDigits.slice(0, 2));
    const expiryYear = Number(expiryDigits.slice(2, 4));
    const now = new Date();
    const currentYear = now.getFullYear() % 100;
    const currentMonth = now.getMonth() + 1;

    if (!email.includes("@")) {
      reportValidationError("email", "Enter a valid email address.");
      return;
    }
    if (digits.length !== 16 || !passesLuhn(digits)) {
      reportValidationError("card_number", "Enter a valid 16-digit card number.");
      return;
    }
    if (
      expiryDigits.length !== 4 ||
      expiryMonth < 1 ||
      expiryMonth > 12 ||
      expiryYear < currentYear ||
      (expiryYear === currentYear && expiryMonth < currentMonth)
    ) {
      reportValidationError("expiry", "Enter an expiry date in the future.");
      return;
    }
    if (cvc.length < 3) {
      reportValidationError("cvc", "Enter a valid security code.");
      return;
    }

    setErrorMessage("");
    setState("processing");
    send({ type: "DODO_STATE_CHANGE", payload: { state: "processing" } });
    await new Promise((resolve) => window.setTimeout(resolve, 900));

    if (digits === "4000000000000002") {
      setState("form");
      setErrorMessage("Your card was declined. Try another card.");
      send({ type: "DODO_ERROR", payload: { code: "card_declined", message: "Your card was declined." } });
      send({ type: "DODO_STATE_CHANGE", payload: { state: "form" } });
      return;
    }

    if (digits === "4000000000000341" && retryCount.current === 0) {
      retryCount.current += 1;
      setState("form");
      setErrorMessage("Enter a valid card number.");
      send({ type: "DODO_ERROR", payload: { code: "processing_error", message: "Payment failed. Retry available." } });
      send({ type: "DODO_STATE_CHANGE", payload: { state: "form" } });
      return;
    }

    const nextSessionId = createSessionId();
    setSessionId(nextSessionId);
    setState("success");
    send({ type: "DODO_SUCCESS", payload: { sessionId: nextSessionId } });
    send({ type: "DODO_STATE_CHANGE", payload: { state: "success" } });
  }

  function closeCheckout(): void {
    send({ type: "DODO_CLOSE", payload: { reason: "user_closed" } });
  }

  function reportValidationError(field: string, message: string): void {
    // Send only the invalid field name and safe error copy to the host Event Log.
    setErrorMessage(message);
    send({ type: "DODO_ERROR", payload: { code: `invalid_${field}`, message } });
    send({ type: "DODO_STATE_CHANGE", payload: { state: `validation_error:${field}` } });
  }

  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: product.currency,
  }).format(product.price / 100);

  return (
    <main className="checkout-page">
      <section className="checkout-card" aria-label="Secure checkout">
        <header className="checkout-header">
          <div className="brand">
            <span className="brand-mark">D</span>
            <span className="brand-name">Dodo Payments</span>
          </div>
          <span className="secure-label">Secure checkout</span>
        </header>

        <div className="checkout-content">
          {state === "loading" && <p>Preparing your checkout...</p>}
          {state === "success" ? (
            <div className="success-message" role="status">
              <strong>Payment successful</strong>
              Your session {sessionId} is confirmed.
            </div>
          ) : state !== "loading" ? (
            <>
              <div className="product-summary">
                <h1>{product.name}</h1>
                <p>{product.description}</p>
                <div className="product-price">{price}</div>
              </div>

              <form className="checkout-form" onSubmit={handleSubmit}>
                <div className="field-group">
                  <label htmlFor="email">Email address</label>
                  <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
                </div>
                <div className="field-group">
                  <label htmlFor="card-number">Card number</label>
                  <input id="card-number" inputMode="numeric" autoComplete="cc-number" value={cardNumber} onChange={(event) => setCardNumber(formatCardNumber(event.target.value))} placeholder="4242 4242 4242 4242" />
                </div>
                <div className="field-row">
                  <div className="field-group">
                    <label htmlFor="expiry">Expiry</label>
                    <input id="expiry" inputMode="numeric" autoComplete="cc-exp" maxLength={7} value={expiry} onChange={(event) => setExpiry(formatExpiry(event.target.value))} placeholder="MM / YY" />
                  </div>
                  <div className="field-group">
                    <label htmlFor="cvc">CVC</label>
                    <input id="cvc" inputMode="numeric" autoComplete="cc-csc" maxLength={4} value={cvc} onChange={(event) => setCvc(event.target.value.replace(/\D/g, ""))} placeholder="123" />
                  </div>
                </div>
                <div className={`error-message${errorMessage ? "" : " error-placeholder"}`} role={errorMessage ? "alert" : undefined}>
                  {errorMessage}
                </div>
                <button className="pay-button" type="submit" disabled={state === "processing"}>
                  {state === "processing" ? "Processing..." : `Pay ${price}`}
                </button>
              </form>
              <p className="checkout-note">Your card details stay inside this secure checkout.</p>
              <button className="close-button" type="button" onClick={closeCheckout}>Cancel</button>
            </>
          ) : null}
        </div>
      </section>
      {state === "processing" && (
        <div className="processing-overlay" role="status" aria-live="polite">
          <div className="processing-modal">
            <span className="processing-orbit" aria-hidden="true">
              <i />
            </span>
            <strong>Securing your payment</strong>
            <p>We are confirming the transaction...</p>
            <div className="processing-progress" aria-hidden="true"><span /></div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Checkout;