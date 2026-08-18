const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Privacy Policy - OrderPing</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #222; }
  h1 { font-size: 28px; }
  h2 { font-size: 20px; margin-top: 32px; }
  p, li { font-size: 15px; }
</style>
</head>
<body>

<h1>Privacy Policy</h1>
<p><strong>Last updated: August 18, 2026</strong></p>

<p>This Privacy Policy explains how OrderPing ("the App," "we," "us") collects, uses, and protects information when a merchant installs and uses the App on their Shopify store.</p>

<h2>1. Information We Collect</h2>
<p>When a merchant installs OrderPing, we may collect and store the following information:</p>
<ul>
  <li>Store information: shop domain, store owner contact details, and access tokens required to communicate with the Shopify Admin API.</li>
  <li>Order information: order number, line items, order total, and customer name, needed to generate order status notification messages.</li>
  <li>Customer phone numbers, used solely to deliver WhatsApp order notification messages.</li>
  <li>WhatsApp Business API credentials (access token, phone number ID) that the merchant enters into the App's Settings page, used to send messages on the merchant's behalf.</li>
</ul>

<h2>2. How We Use Information</h2>
<p>We use the information we collect only to operate the App's core functionality:</p>
<ul>
  <li>Sending automated WhatsApp order status notifications to customers on behalf of the merchant.</li>
  <li>Displaying a notification history log inside the App so merchants can review sent and failed messages.</li>
  <li>Authenticating the App with the merchant's Shopify store.</li>
</ul>
<p>We do not sell customer data, and we do not use customer data for advertising or marketing purposes unrelated to order notifications.</p>

<h2>3. Third-Party Services</h2>
<p>To deliver WhatsApp messages, the App sends message content and the customer's phone number to Meta's WhatsApp Business Cloud API. Meta's use of this data is governed by their own privacy policy, available at
<a href="https://www.whatsapp.com/legal/privacy-policy">https://www.whatsapp.com/legal/privacy-policy</a>.</p>

<h2>4. Data Storage and Security</h2>
<p>Order and customer data used by the App is stored in a secured database and is only accessible to authorized systems required to operate the App. WhatsApp API credentials entered by merchants are stored per-shop and are not shared between merchants.</p>

<h2>5. Data Retention</h2>
<p>We retain order and notification data for as long as the App remains installed on a store, so merchants can view notification history. If a merchant uninstalls the App, associated shop data is deleted in accordance with Shopify's app uninstalled webhook requirements.</p>

<h2>6. Customer Rights and Data Requests</h2>
<p>In compliance with Shopify's mandatory privacy webhooks, we support:</p>
<ul>
  <li><strong>Customer data requests:</strong> merchants or customers may request a copy of stored customer data related to their store.</li>
  <li><strong>Customer data redaction:</strong> customer data can be deleted upon request.</li>
  <li><strong>Shop data redaction:</strong> all shop-related data is deleted after the App is uninstalled, following Shopify's required retention period.</li>
</ul>

<h2>7. Contact Us</h2>
<p>If you have questions about this Privacy Policy or wish to request access to, or deletion of, your data, please contact us at:</p>
<p><strong>Email:</strong> [SUPPORT_EMAIL]</p>

<h2>8. Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last updated" date.</p>

</body>
</html>
`;

export const loader = async () => {
  return new Response(HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};
