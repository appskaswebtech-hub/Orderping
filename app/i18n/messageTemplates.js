// WhatsApp message TEMPLATE BODIES, as approved on Meta — distinct from
// translations.js, which covers the admin dashboard's own UI text. These
// strings are shown on the Settings page so merchants (especially ones using
// their own Meta account) can paste the exact approved wording in, and must
// match character-for-character what's actually live on Meta for each
// (name, language) pair, or merchants' own templates won't match what the
// webhook code sends.
//
// English wording is kept as originally approved (even where a stricter
// Meta validation would now reject fresh submissions of the same phrasing,
// e.g. a trailing variable) since the live English templates already exist
// and work. French/Spanish/German/Italian had to be phrased to satisfy that
// stricter validation when they were newly submitted.
export const MESSAGE_TEMPLATES = {
  order_confirmation_image: {
    en: "Hi {{1}}, your order #{{2}} has been confirmed!\n\nItem(s): {{3}}\nTotal: {{4}}\n\nThank you for shopping with us!",
    fr: "Bonjour {{1}}, votre commande #{{2}} a été confirmée !\n\nArticle(s) : {{3}}\nTotal : {{4}}\n\nMerci de votre achat !",
    es: "Hola {{1}}, ¡tu pedido #{{2}} ha sido confirmado!\n\nArtículo(s): {{3}}\nTotal: {{4}}\n\n¡Gracias por tu compra!",
    de: "Hallo {{1}}, Ihre Bestellung #{{2}} wurde bestätigt!\n\nArtikel: {{3}}\nGesamt: {{4}}\n\nDanke für Ihren Einkauf!",
    it: "Ciao {{1}}, il tuo ordine #{{2}} è stato confermato!\n\nArticolo/i: {{3}}\nTotale: {{4}}\n\nGrazie per il tuo acquisto!",
  },
  order_shipped: {
    en: "Hi {{1}}, good news! Your order #{{2}} has shipped.\nTracking: {{3}}",
    fr: "Bonjour {{1}}, bonne nouvelle ! Votre commande #{{2}} a été expédiée.\nSuivi : {{3}}\nMerci pour votre commande !",
    es: "Hola {{1}}, ¡buenas noticias! Tu pedido #{{2}} ha sido enviado.\nSeguimiento: {{3}}\n¡Gracias por tu pedido!",
    de: "Hallo {{1}}, gute Nachrichten! Ihre Bestellung #{{2}} wurde versandt.\nSendungsverfolgung: {{3}}\nVielen Dank für Ihre Bestellung!",
    it: "Ciao {{1}}, buone notizie! Il tuo ordine #{{2}} è stato spedito.\nTracciamento: {{3}}\nGrazie per il tuo ordine!",
  },
  order_out_for_delivery: {
    en: "Hi {{1}}, your order #{{2}} is out for delivery and should arrive today.",
    fr: "Bonjour {{1}}, votre commande #{{2}} est en cours de livraison et devrait arriver aujourd'hui.",
    es: "Hola {{1}}, tu pedido #{{2}} está en reparto y debería llegar hoy.",
    de: "Hallo {{1}}, Ihre Bestellung #{{2}} ist unterwegs zur Zustellung und sollte heute ankommen.",
    it: "Ciao {{1}}, il tuo ordine #{{2}} è in consegna e dovrebbe arrivare oggi.",
  },
  order_delivered: {
    en: "Hi {{1}}, your order #{{2}} has been delivered. Thank you for shopping with us!",
    fr: "Bonjour {{1}}, votre commande #{{2}} a été livrée. Merci de votre achat !",
    es: "Hola {{1}}, tu pedido #{{2}} ha sido entregado. ¡Gracias por tu compra!",
    de: "Hallo {{1}}, Ihre Bestellung #{{2}} wurde zugestellt. Danke für Ihren Einkauf!",
    it: "Ciao {{1}}, il tuo ordine #{{2}} è stato consegnato. Grazie per il tuo acquisto!",
  },
  order_refund_initiated: {
    en: "Hi {{1}}, a refund of {{3}} has been initiated for your order #{{2}}. It should reflect in 5-10 business days.",
    fr: "Bonjour {{1}}, un remboursement de {{3}} a été initié pour votre commande #{{2}}. Il devrait apparaître sous 5 à 10 jours ouvrés.",
    es: "Hola {{1}}, se ha iniciado un reembolso de {{3}} para tu pedido #{{2}}. Debería reflejarse en 5-10 días hábiles.",
    de: "Hallo {{1}}, für Ihre Bestellung #{{2}} wurde eine Rückerstattung von {{3}} eingeleitet. Sie sollte innerhalb von 5-10 Werktagen sichtbar sein.",
    it: "Ciao {{1}}, è stato avviato un rimborso di {{3}} per il tuo ordine #{{2}}. Dovrebbe essere visibile entro 5-10 giorni lavorativi.",
  },
  order_cancelled: {
    en: "Hi {{1}}, your order #{{2}} has been cancelled. Reason: {{3}}",
    fr: "Bonjour {{1}}, votre commande #{{2}} a été annulée. Motif : {{3}}. Nous sommes désolés pour la gêne occasionnée.",
    es: "Hola {{1}}, tu pedido #{{2}} ha sido cancelado. Motivo: {{3}}. Lamentamos las molestias.",
    de: "Hallo {{1}}, Ihre Bestellung #{{2}} wurde storniert. Grund: {{3}}. Entschuldigung für die Unannehmlichkeiten.",
    it: "Ciao {{1}}, il tuo ordine #{{2}} è stato annullato. Motivo: {{3}}. Ci scusiamo per il disagio.",
  },
  order_paid: {
    en: "Hi {{1}}, we've received your payment of {{3}} for order #{{2}}. Thank you!",
    fr: "Bonjour {{1}}, nous avons bien reçu votre paiement de {{3}} pour la commande #{{2}}. Merci !",
    es: "Hola {{1}}, hemos recibido tu pago de {{3}} por el pedido #{{2}}. ¡Gracias!",
    de: "Hallo {{1}}, wir haben Ihre Zahlung von {{3}} für Bestellung #{{2}} erhalten. Danke!",
    it: "Ciao {{1}}, abbiamo ricevuto il tuo pagamento di {{3}} per l'ordine #{{2}}. Grazie!",
  },
  order_partially_fulfilled: {
    en: "Hi {{1}}, part of your order #{{2}} has shipped. The rest is on its way soon.",
    fr: "Bonjour {{1}}, une partie de votre commande #{{2}} a été expédiée. Le reste arrive bientôt.",
    es: "Hola {{1}}, parte de tu pedido #{{2}} ha sido enviada. El resto llegará pronto.",
    de: "Hallo {{1}}, ein Teil Ihrer Bestellung #{{2}} wurde versandt. Der Rest ist bald unterwegs.",
    it: "Ciao {{1}}, parte del tuo ordine #{{2}} è stata spedita. Il resto è in arrivo a breve.",
  },
};

// Meta language codes used when SENDING each template (matches what's live
// on Meta). order_confirmation_image and all the carousel templates
// (order_confirmation_slider*) use the "en_US"/regional form only for
// English, a historical quirk from how they were first approved — every
// other language, and every other template, uses the plain two-letter code.
const EN_US_TEMPLATES = new Set(["order_confirmation_image"]);

export function templateLanguageCode(templateName, locale) {
  if (locale !== "en") return locale;
  if (EN_US_TEMPLATES.has(templateName) || templateName.startsWith("order_confirmation_slider")) {
    return "en_US";
  }
  return locale;
}
