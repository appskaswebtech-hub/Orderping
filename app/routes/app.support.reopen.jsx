import { data } from "react-router";
import { authenticate } from "../shopify.server.js";
import { reopenThread } from "../support-chat.server.js";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  await reopenThread(session.shop);
  return data({ ok: true });
};
