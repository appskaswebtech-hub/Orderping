// Public, unauthenticated redirect used by the carousel WhatsApp template's
// "Shop now" button. WhatsApp URL buttons only support one fixed base URL per
// template, shared across every merchant on this app, so the button points
// here with a token encoding which shop/product to send the customer to,
// and this route 302s them to the real product page.
import { redirect } from "react-router";

export const loader = async ({ params }) => {
  try {
    const decoded = Buffer.from(params.token, "base64url").toString("utf8");
    const [shop, handle] = decoded.split("|");
    if (!shop || !handle) return redirect("https://whatsnotify.kaswebtechsolutions.com/");
    return redirect(`https://${shop}/products/${handle}`);
  } catch (err) {
    return redirect("https://whatsnotify.kaswebtechsolutions.com/");
  }
};
