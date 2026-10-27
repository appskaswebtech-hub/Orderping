import { data } from "react-router";
import { authenticate } from "../shopify.server.js";
import { getMessages, markRead, sendMessage } from "../support-chat.server.js";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  if (url.searchParams.get("seen") === "1") {
    await markRead(session.shop, "shop");
  }
  const result = await getMessages(session.shop);
  return data(result);
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const body = formData.get("body");
  const file = formData.get("file");
  const message = await sendMessage({
    shop: session.shop,
    sender: "shop",
    body: typeof body === "string" ? body : null,
    file: file instanceof File && file.size > 0 ? file : null,
  });
  return data({ message });
};
