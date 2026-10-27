import { data } from "react-router";
import { authenticate } from "../shopify.server.js";
import { notifyDashboard } from "../support-chat.server.js";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  void notifyDashboard(session.shop, { type: "typing" }).catch((error) => {
    console.error("Could not notify Supportly about merchant typing.", error);
  });
  return data({ ok: true });
};
