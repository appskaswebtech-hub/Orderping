import { data } from "react-router";
import { authenticate } from "../shopify.server.js";
import { closeThread } from "../support-chat.server.js";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  await closeThread(session.shop);
  return data({ ok: true });
};
