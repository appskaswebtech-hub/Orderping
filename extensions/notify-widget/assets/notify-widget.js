// Notify Me widget (copied from public/notify-widget.js)
(function(){
  // Simple Notify Me widget
  function createWidget(_options){
    const container = document.createElement('div');
    container.id = 'notify-me-widget';
    container.style.position = 'fixed';
    container.style.right = '16px';
    container.style.bottom = '16px';
    container.style.zIndex = 99999;
    container.innerHTML = `
      <button id="nm-open" style="padding:10px 14px;border-radius:6px;border:none;background:#2b66ff;color:#fff;cursor:pointer">Notify me</button>
      <div id="nm-modal" style="display:none;position:fixed;right:16px;bottom:64px;width:320px;background:#fff;border:1px solid #ddd;padding:16px;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,0.12);}">
        <div style="font-weight:600;margin-bottom:8px">Get notified via WhatsApp</div>
        <div style="margin-bottom:8px"><input id="nm-name" placeholder="Your name (optional)" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px"/></div>
        <div style="margin-bottom:8px"><select id="nm-country" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px"><option value="+1">United States (+1)</option><option value="+44">United Kingdom (+44)</option><option value="+61">Australia (+61)</option><option value="+91">India (+91)</option></select></div>
        <div style="margin-bottom:8px"><input id="nm-phone" placeholder="Phone number" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px"/></div>
        <div style="margin-bottom:8px"><label><input type="checkbox" id="nm-optin"/> I agree to receive WhatsApp notifications</label></div>
        <div style="display:flex;gap:8px"><button id="nm-submit" style="flex:1;padding:10px;border-radius:6px;border:none;background:#2b66ff;color:#fff;cursor:pointer">Submit</button><button id="nm-cancel" style="flex:1;padding:10px;border-radius:6px;border:1px solid #ccc;background:#fff;cursor:pointer">Close</button></div>
        <div id="nm-msg" style="margin-top:8px;color:#d23636;display:none"></div>
      </div>
    `;
    document.body.appendChild(container);

    const open = container.querySelector('#nm-open');
    const modal = container.querySelector('#nm-modal');
    const cancel = container.querySelector('#nm-cancel');
    const submit = container.querySelector('#nm-submit');
    const msg = container.querySelector('#nm-msg');

    function showModal(){ modal.style.display = 'block'; }
    function hideModal(){ modal.style.display = 'none'; msg.style.display='none'; }

    open.addEventListener('click', showModal);
    cancel.addEventListener('click', hideModal);

    function normalizePhone(countryCode, raw){
      if(!raw) return null;
      let digits = raw.replace(/\D/g,'');
      // If the number already includes country code (starts with country digits), don't double
      if(digits.startsWith(countryCode.replace('+',''))) return '+'+digits;
      return countryCode + digits.replace(/^0+/, '');
    }

    submit.addEventListener('click', async ()=>{
      const name = container.querySelector('#nm-name').value.trim();
      const country = container.querySelector('#nm-country').value;
      const rawPhone = container.querySelector('#nm-phone').value.trim();
      const optin = container.querySelector('#nm-optin').checked;
      if(!optin){ msg.innerText = 'You must agree to receive WhatsApp messages.'; msg.style.display='block'; return; }
      const phone = normalizePhone(country, rawPhone);
      if(!phone || phone.replace(/\D/g,'').length < 8){ msg.innerText = 'Enter a valid phone number.'; msg.style.display='block'; return; }

      try{
        // Routed through Shopify's App Proxy so the request is signed and verified
        // server-side (shop is taken from that signed context, not from this body).
        const res = await fetch('/apps/notify/collect_optin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, country })
        });
        if(res.ok){
          msg.style.color = '#0a8f3e'; msg.innerText = 'Thanks — you will be notified.'; msg.style.display='block';
          setTimeout(hideModal, 2000);
        } else {
          const j = await res.json().catch(()=>null);
          msg.innerText = j?.error || 'Failed to save. Try again later.'; msg.style.display='block';
        }
      } catch(e){ msg.innerText = 'Network error'; msg.style.display='block'; }
    });
  }

  // Auto-init if window.NM_AUTO_INIT is true
  if(window.NM_AUTO_INIT){ createWidget(window.NM_OPTIONS || {}); }
  window.NotifyMeWidget = { init: createWidget };
})();
