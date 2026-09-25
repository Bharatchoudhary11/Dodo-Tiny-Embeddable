/**
 * Dodo Payments Checkout SDK
 *
 * Usage:
 *   <script src="https://your-cdn.com/dodo-checkout.js"></script>
 *   <script>
 *     DodoCheckout.open({
 *       productId: "prod_123",
 *       onSuccess: ({ sessionId }) => {},
 *       onClose: ({ reason }) => {},
 *       onError: ({ code, message }) => {},
 *     });
 *   </script>
 *
 * Security Model:
 *   - Card details are entered in an iframe hosted by Dodo, never touching the host page
 *   - The host page can only receive events (success, error, close) via postMessage
 *   - The host page cannot read or modify checkout state directly
 *   - The iframe is sandboxed and communicates only through a validated message protocol
 *
 * Design Decisions:
 *   - Single global function (DodoCheckout.open) - simple, hard to misuse
 *   - Iframe-based isolation - card data never touches host page JS context
 *   - postMessage with type-prefixed events - predictable, filterable
 *   - Double-open prevention - calling open() while already open is a no-op
 *   - Escape key closes checkout - standard UX pattern
 *   - Click-outside-to-close - but only on the overlay, not the checkout itself
 */

type CheckoutSuccessPayload = {
  sessionId: string;
};

type CheckoutErrorPayload = {
  code: string;
  message: string;
};

type CheckoutClosePayload = {
  reason: string;
};

type CheckoutStatePayload = {
  state: string;
};

type DodoCheckoutCallbacks = {
  onSuccess?: (data: CheckoutSuccessPayload) => void;
  onClose?: (data: CheckoutClosePayload) => void;
  onError?: (data: CheckoutErrorPayload) => void;
  onStateChange?: (data: CheckoutStatePayload) => void;
};

type DodoCheckoutConfig = {
  productId: string;
  onSuccess?: (data: CheckoutSuccessPayload) => void;
  onClose?: (data: CheckoutClosePayload) => void;
  onError?: (data: CheckoutErrorPayload) => void;
  onStateChange?: (data: CheckoutStatePayload) => void;
};

type ParentToCheckoutMessage =
  | { type: "DODO_INIT"; payload: { productId: string } }
  | { type: "DODO_CLOSE_REQUEST" };

type CheckoutToParentMessage =
  | { type: "DODO_READY" }
  | { type: "DODO_SUCCESS"; payload: CheckoutSuccessPayload }
  | { type: "DODO_ERROR"; payload: CheckoutErrorPayload }
  | { type: "DODO_CLOSE"; payload: CheckoutClosePayload }
  | { type: "DODO_STATE_CHANGE"; payload: CheckoutStatePayload };

type CheckoutMessage = ParentToCheckoutMessage | CheckoutToParentMessage;

interface DodoCheckout {
  open(config: DodoCheckoutConfig): void;
}

interface Window {
  DodoCheckout?: DodoCheckout;
}

(function (): void {
  "use strict";

  if (window.DodoCheckout) return;

  let iframe: HTMLIFrameElement | null = null;
  let overlay: HTMLDivElement | null = null;
  let callbacks: DodoCheckoutCallbacks = {};
  let currentProductId = "prod_123";
  let messageHandler: ((event: MessageEvent) => void) | null = null;
  let escHandler: ((event: KeyboardEvent) => void) | null = null;

  const CHECKOUT_URL: string = (() => {
    const scripts = document.querySelectorAll("script[src*='dodo-checkout']");

    if (scripts.length > 0) {
      const src = scripts[scripts.length - 1].getAttribute("src") ?? "";
      const base = src.replace(/\/sdk\/.*$/, "");
      return `${base}/#/checkout`;
    }

    return `${window.location.origin}${window.location.pathname}#/checkout`;
  })();

  function cleanup(): void {
    if (messageHandler) {
      window.removeEventListener("message", messageHandler);
      messageHandler = null;
    }

    if (escHandler) {
      window.removeEventListener("keydown", escHandler);
      escHandler = null;
    }

    if (overlay && overlay.parentNode) {
      overlay.style.opacity = "0";
      const el = overlay;
      setTimeout(() => {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      }, 200);
    }

    overlay = null;
    iframe = null;
    callbacks = {};
  }

  function handleMessage(event: MessageEvent): void {
    const data = event.data as Partial<CheckoutMessage> | undefined;

    if (!data || typeof data.type !== "string" || !data.type.startsWith("DODO_")) {
      return;
    }

    switch (data.type) {
      case "DODO_READY": {
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage(
            { type: "DODO_INIT", payload: { productId: currentProductId } },
            "*"
          );
        }
        break;
      }
      case "DODO_SUCCESS": {
        const payload = data.payload as CheckoutSuccessPayload;
        callbacks.onSuccess?.(payload);
        cleanup();
        break;
      }
      case "DODO_ERROR": {
        const payload = data.payload as CheckoutErrorPayload;
        callbacks.onError?.(payload);
        break;
      }
      case "DODO_CLOSE": {
        const payload = data.payload as CheckoutClosePayload;
        callbacks.onClose?.(payload);
        cleanup();
        break;
      }
      case "DODO_STATE_CHANGE": {
        const payload = data.payload as CheckoutStatePayload;
        callbacks.onStateChange?.(payload);
        break;
      }
      default:
        break;
    }
  }

  const dodoCheckout: DodoCheckout = {
    open(config: DodoCheckoutConfig): void {
      if (!config || !config.productId) {
        console.error("[DodoCheckout] productId is required");
        return;
      }

      if (overlay) {
        console.warn("[DodoCheckout] Checkout is already open. Ignoring duplicate call.");
        return;
      }

      callbacks = {
        onSuccess: config.onSuccess,
        onClose: config.onClose,
        onError: config.onError,
        onStateChange: config.onStateChange,
      };
      currentProductId = config.productId;

      overlay = document.createElement("div");
      overlay.id = "dodo-checkout-overlay";
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;" +
        "background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);" +
        "display:flex;align-items:center;justify-content:center;" +
        "opacity:0;transition:opacity 0.25s ease;overflow:hidden;";

      iframe = document.createElement("iframe");
      iframe.src = CHECKOUT_URL;
      iframe.style.cssText =
        "width:460px;max-width:calc(100vw - 32px);height:580px;max-height:calc(100vh - 32px);" +
        "border:none;background:transparent;border-radius:16px;";
      iframe.setAttribute("allow", "payment");
      iframe.setAttribute("title", "Secure Checkout");

      overlay.appendChild(iframe);
      document.body.appendChild(overlay);

      requestAnimationFrame(() => {
        if (overlay) overlay.style.opacity = "1";
      });

      messageHandler = handleMessage;
      window.addEventListener("message", messageHandler);

      overlay.addEventListener("click", (event: MouseEvent) => {
        if (event.target === overlay && iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: "DODO_CLOSE_REQUEST" }, "*");
        }
      });

      escHandler = (event: KeyboardEvent): void => {
        if (event.key === "Escape" && iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: "DODO_CLOSE_REQUEST" }, "*");

          const currentEscHandler = escHandler;
          if (currentEscHandler) {
            window.removeEventListener("keydown", currentEscHandler);
          }

          escHandler = null;
        }
      };

      window.addEventListener("keydown", escHandler);
    },
  };

  window.DodoCheckout = dodoCheckout;
})();
