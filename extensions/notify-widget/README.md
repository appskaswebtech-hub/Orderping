Notify Me Theme Snippet

This folder contains a minimal Theme-like extension scaffold for the Notify Me widget.

Files:
- `snippets/notify-me.liquid` — Liquid snippet to include in theme templates. Replace `YOUR_APP_URL` with your app URL.
- `assets/notify-widget.js` — Client widget that renders the "Notify me" button and modal.
- `extension.config.yml` — Minimal metadata for this scaffold.

Install options for a merchant (Partner/store owner):
1) Manual theme include (quickest for testing):
   - Edit the theme code: add the contents of `snippets/notify-me.liquid` as a snippet named `notify-me`.
   - Include it where you want the button, e.g. in `sections/product-template.liquid` or `templates/product.liquid`:
     {% include 'notify-me' %}
   - Ensure the snippet's `YOUR_APP_URL` is replaced with your app URL (e.g. https://your-app.ngrok.io).

2) ScriptTag (no theme edit required):
   - Create a ScriptTag in the store admin that points to `https://your-app/notify-widget.js`.
   - The widget will initialize and attempt to read `shop.domain` for shop context; you can call `NotifyMeWidget.init({ shop: 'your-shop.myshopify.com' })` from the page if needed.

Notes:
- This scaffold is intentionally minimal to make testing simple. For production, use a proper Theme App Extension (Shopify CLI `shopify extension create theme`), host assets from your app, and register the extension with the app listing.
- For robust phone validation use `libphonenumber-js` on the client; current normalization is basic.
