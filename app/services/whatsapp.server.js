// Minimal WhatsApp Cloud API service for sending messages

async function sendTextMessage({ to, body, accessToken, phoneNumberId, apiVersion = "v17.0" }) {
  const token = accessToken || process.env.META_ACCESS_TOKEN;
  const phoneId = phoneNumberId || process.env.META_PHONE_NUMBER_ID;
  const version = apiVersion || process.env.META_API_VERSION || "v17.0";

  if (!token || !phoneId) {
    throw new Error("Missing Meta WhatsApp configuration (accessToken or phoneNumberId)");
  }

  const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  };

  const res = await fetch(url, {
    method: "POST",
    headers
    : {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error("Meta WhatsApp API error");
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data;
}

async function sendTemplateMessage({ to, templateName, language = "en_US", components, accessToken, phoneNumberId, apiVersion = "v17.0" }) {
  const token = accessToken || process.env.META_ACCESS_TOKEN;
  const phoneId = phoneNumberId || process.env.META_PHONE_NUMBER_ID;
  const version = apiVersion || process.env.META_API_VERSION || "v17.0";

  if (!token || !phoneId) {
    throw new Error("Missing Meta WhatsApp configuration (accessToken or phoneNumberId)");
  }

  const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components: components || [],
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error("Meta WhatsApp API error");
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data;
}

async function testConnection({ accessToken, phoneNumberId, apiVersion = "v17.0" }) {
  const token = accessToken || process.env.META_ACCESS_TOKEN;
  const phoneId = phoneNumberId || process.env.META_PHONE_NUMBER_ID;
  const version = apiVersion || process.env.META_API_VERSION || "v17.0";

  if (!token || !phoneId) {
    throw new Error("Missing Meta WhatsApp configuration for test");
  }

  const url = `https://graph.facebook.com/${version}/${phoneId}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error("Meta WhatsApp test connection failed");
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export { sendTextMessage, sendTemplateMessage, testConnection };
