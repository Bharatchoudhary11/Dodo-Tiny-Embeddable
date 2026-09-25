

A tiny embeddable checkout built in three steps. Parts 1 and 2 are implemented: the SDK creates an isolated iframe, and the checkout app handles the payment form inside it.

## Build Steps

1. **SDK foundation** (`public/sdk/dodo-checkout.ts`) - expose `DodoCheckout.open()`, create the checkout overlay, and define the host/iframe message contract.
2. **Checkout app** (`src/pages/Checkout.tsx`) - render the product, email, card, expiry, and CVC fields inside the iframe and process fake payment states.
3. **Demo site** - add a host page with a Buy button and a visible callback event log.

## Communication

The SDK and checkout communicate through `window.postMessage`:

1. The host calls `DodoCheckout.open({ productId, ...callbacks })`.
2. The SDK creates an iframe at `/#/checkout`.
3. The checkout sends `DODO_READY`; the SDK responds with `DODO_INIT` and the product data.
4. The checkout keeps card details inside the iframe and sends only high-level events such as `DODO_SUCCESS`, `DODO_ERROR`, and `DODO_CLOSE`.
5. The SDK invokes the matching host-page callback.

The iframe is the security boundary: card details never enter the host page.

## Setup

Install Node.js 18 or newer, then run:

```bash
pnpm install
pnpm dev
```

Open the checkout directly at <http://localhost:3000/#/checkout>. If port 3000 is already in use, start Vite on another port:

```bash
pnpm exec vite --port 3001
```

Then open <http://localhost:3001/#/checkout>.

Useful commands:

```bash
pnpm lint
pnpm build
```

To use the SDK from another website, serve or deploy this project and include:

```html
<script src="https://your-checkout-domain.example/sdk/dodo-checkout.ts"></script>
<script>
  DodoCheckout.open({
    productId: "prod_123",
    onSuccess({ sessionId }) {
      console.log("Payment complete", sessionId);
    },
    onError({ code, message }) {
      console.error(code, message);
    },
    onClose({ reason }) {
      console.log("Checkout closed", reason);
    },
  });
</script>
```

## Checkout Behavior

- Duplicate SDK opens are ignored while a checkout is already open.
- Escape and clicking outside the iframe request a close.
- Invalid email, card, expiry, and CVC values stay in the checkout and show an error.
- Expiry input turns a single digit such as `2` into `02 / ` and accepts months only from `01` to `12`.
- Card details remain inside the iframe; the host receives only checkout events.

## Test Cards

| Card Number | Behavior |
| --- | --- |
| `4242 4242 4242 4242` | Payment succeeds |
| `4000 0000 0000 0002` | Card is declined |
| `4000 0000 0000 0341` | Fails once, then succeeds on retry |

Use any four-digit expiry and a three- or four-digit CVC with the test cards.
