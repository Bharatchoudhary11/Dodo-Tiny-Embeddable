# Dodo Payments - Part 1: SDK Foundation

This repository is being built in three deliberate steps. The current step contains only the standalone SDK script, which a developer can drop into an existing website.

## Build Steps

1. **SDK foundation** (`public/sdk/dodo-checkout.ts`) - expose `DodoCheckout.open()`, create the checkout overlay, and define the host/iframe message contract.
2. **Checkout app** - add the isolated payment form and fake payment states inside the iframe.
3. **Demo site** - add a host page with a Buy button and a visible callback event log.

Only Part 1 is implemented right now. Parts 2 and 3 are intentionally removed until their respective steps.

## Setup and Usage

Install Node.js 18 or newer, then install dependencies:

```bash
git clone <repository-url>
cd tiny-embeddable-checkout
npm install
```

Start the development server:

```bash
npm run dev
```

Open <http://localhost:3000> to view the current milestone.

Useful commands:

```bash
npm run lint
npm run build
```

To use the SDK from another website, serve or deploy the SDK file and include:

```html
<script src="https://your-checkout-domain.example/sdk/dodo-checkout.ts"></script>
<script>
  DodoCheckout.open({
    productId: "pro-plan",
    onSuccess(result) {
      console.log("Payment complete", result.sessionId);
    },
    onError(error) {
      console.error("Payment failed", error);
    },
    onClose() {
      console.log("Checkout closed");
    },
  });
</script>
```

The checkout URL will be connected when Part 2 is implemented.
