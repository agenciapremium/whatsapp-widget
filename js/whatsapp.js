(function () {
  // ====== CONFIG ======
  const WEBHOOK_URL = 'https://agpremium-n8n.ayfki5.easypanel.host/webhook/whatsapp-router'; // <- ajuste para o seu n8n
  const BRAND_COLOR = '#25D366';
  const ACCENT_COLOR = '#128C7E';
  const WIDGET_TITLE = 'Falar no WhatsApp';
  const MSG_INICIAL = (nome, unidade) => `Ol ! Sou ${nome}. Quero atendimento da unidade ${unidade}.`;
  const UNITS_FALLBACK = {
    "Boa Vista": ["+5595991547084","+5595991755693","+5595991154487"],
    "Manaus": ["+559236547373","+559236346204"],
    "Porto Velho": ["+556932248204","+556930263103"],
    "Ji-Paran ": ["+5569992520070"]
  };

  // ====== SAFE BOOTSTRAP ======
  function onReady(fn){
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(fn, 0);
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }
  function ensureHead(){
    if (!document.head) {
      const h = document.createElement('head');
      document.documentElement.prepend(h);
    }
    return document.head;
  }
  function ensureBody(cb){
    if (document.body) return cb(document.body);
    const obs = new MutationObserver(() => {
      if (document.body) {
        obs.disconnect();
        cb(document.body);
      }
    });
    obs.observe(document.documentElement, {childList:true, subtree:true});
  }

  onReady(() => {
    ensureHead();
    ensureBody(init);
  });

  // ====== APP ======
  function init() {
    // --- Utils ---
    const $ = (sel, el=document) => el.querySelector(sel);
    const stripToDigits = (s) => (s||'').replace(/\D+/g,'');
    const ls = {
      get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
      set(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
    };
    function nextRoundRobin(unit, list) {
      const key = 'wa_rr_idx_'+unit;
      let idx = Number(ls.get(key) || 0);
      const num = list[idx % list.length];
      ls.set(key, (idx+1) % list.length);
      return num;
    }
    async function postJSON(url, data) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(data),
          credentials: 'omit',
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('HTTP '+res.status);
        return await res.json();
      } catch (e) { console.warn('[WA] webhook falhou:', e); return null; }
    }
    function openWhatsappRedirect(numero, textoMsg) {
      const digits = stripToDigits(numero);
      const url = `https://wa.me/${digits}?text=${encodeURIComponent(textoMsg)}`;
      window.location.href = url;
    }

    // --- CSS ---
    const css = `
    .wa-fab{position:fixed;right:18px;bottom:18px;width:64px;height:64px;border-radius:50%;
      background:${BRAND_COLOR};display:flex;align-items:center;justify-content:center;cursor:pointer;
      box-shadow:0 10px 24px rgba(0,0,0,.25);z-index:999999;transition:transform .18s ease;}
    .wa-fab:hover{transform:scale(1.06);}
    .wa-fab svg{width:36px;height:36px;display:block}
    .wa-wrap{position:fixed;right:18px;bottom:92px;z-index:999999;max-width:360px;width:92vw;}
    .wa-card{background:#fff;border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,.24);
      overflow:hidden;transform-origin:bottom right;animation:wa-pop .2s ease;}
    @keyframes wa-pop{from{transform:scale(.92);opacity:.0} to{transform:scale(1);opacity:1}}
    .wa-head{background:${ACCENT_COLOR};color:#fff;padding:14px 16px;font-weight:600}
    .wa-body{padding:14px 16px}
    .wa-row{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
    .wa-row label{font-size:.9rem;color:#333}
    .wa-input, .wa-select{width:100%;border:1px solid #e0e0e0;border-radius:10px;padding:12px 12px;
      outline:none;font-size:14px;transition:border-color .15s ease;}
    .wa-input:focus, .wa-select:focus{border-color:${ACCENT_COLOR}}
    .wa-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:4px}
    .wa-btn{border:0;border-radius:10px;padding:12px 16px;font-weight:600;font-size:.95rem;cursor:pointer}
    .wa-btn.primary{background:${BRAND_COLOR};color:#fff}
    .wa-btn.ghost{background:#f5f5f5;color:#333}
    .wa-foot{padding:10px 16px;border-top:1px solid #f0f0f0;font-size:.8rem;color:#666}
    .wa-error{color:#b00020;font-size:.85rem;margin-top:-6px;margin-bottom:8px;display:none}
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // --- FAB (com o seu SVG) ---
    const fab = document.createElement('button');
    fab.className = 'wa-fab';
    fab.setAttribute('aria-label','WhatsApp');
    fab.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#fff" d="M4.9,43.3l2.7-9.8C5.9,30.6,5,27.3,5,24C5,13.5,13.5,5,24,5c5.1,0,9.8,2,13.4,5.6 C41,14.2,43,18.9,43,24c0,10.5-8.5,19-19,19c0,0,0,0,0,0h0c-3.2,0-6.3-0.8-9.1-2.3L4.9,43.3z"></path>
        <path fill="#fff" d="M4.9,43.8c-0.1,0-0.3-0.1-0.4-0.1c-0.1-0.1-0.2-0.3-0.1-0.5L7,33.5c-1.6-2.9-2.5-6.2-2.5-9.6 C4.5,13.2,13.3,4.5,24,4.5c5.2,0,10.1,2,13.8,5.7c3.7,3.7,5.7,8.6,5.7,13.8c0,10.7-8.7,19.5-19.5,19.5c-3.2,0-6.3-0.8-9.1-2.3 L5,43.8C5,43.8,4.9,43.8,4.9,43.8z"></path>
        <path fill="#cfd8dc" d="M24,5c5.1,0,9.8,2,13.4,5.6C41,14.2,43,18.9,43,24c0,10.5-8.5,19-19,19h0c-3.2,0-6.3-0.8-9.1-2.3 L4.9,43.3l2.7-9.8C5.9,30.6,5,27.3,5,24C5,13.5,13.5,5,24,5 M24,43L24,43L24,43 M24,43L24,43L24,43 M24,4L24,4C13,4,4,13,4,24 c0,3.4,0.8,6.7,2.5,9.6L3.9,43c-0.1,0.3,0,0.7,0.3,1c0.2,0.2,0.4,0.3,0.7,0.3c0.1,0,0.2,0,0.3,0l9.7-2.5c2.8,1.5,6,2.2,9.2,2.2 c11,0,20-9,20-20c0-5.3-2.1-10.4-5.8-14.1C34.4,6.1,29.4,4,24,4L24,4z"></path>
        <path fill="#40c351" d="M35.2,12.8c-3-3-6.9-4.6-11.2-4.6C15.3,8.2,8.2,15.3,8.2,24c0,3,0.8,5.9,2.4,8.4L11,33l-1.6,5.8 l6-1.6l0.6,0.3c2.4,1.4,5.2,2.2,8,2.2h0c8.7,0,15.8-7.1,15.8-15.8C39.8,19.8,38.2,15.8,35.2,12.8z"></path>
        <path fill="#fff" fill-rule="evenodd" d="M19.3,16c-0.4-0.8-0.7-0.8-1.1-0.8c-0.3,0-0.6,0-0.9,0 s-0.8,0.1-1.3,0.6c-0.4,0.5-1.7,1.6-1.7,4s1.7,4.6,1.9,4.9s3.3,5.3,8.1,7.2c4,1.6,4.8,1.3,5.7,1.2c0.9-0.1,2.8-1.1,3.2-2.3 c0.4-1.1,0.4-2.1,0.3-2.3c-0.1-0.2-0.4-0.3-0.9-0.6s-2.8-1.4-3.2-1.5c-0.4-0.2-0.8-0.2-1.1,0.2c-0.3,0.5-1.2,1.5-1.5,1.9 c-0.3,0.3-0.6,0.4-1,0.1c-0.5-0.2-2-0.7-3.8-2.4c-1.4-1.3-2.4-2.8-2.6-3.3c-0.3-0.5,0-0.7,0.2-1c0.2-0.2,0.5-0.6,0.7-0.8 c0.2-0.3,0.3-0.5,0.5-0.8c0.2-0.3,0.1-0.6,0-0.8C20.6,19.3,19.7,17,19.3,16z" clip-rule="evenodd"></path>
      </svg>
    `;
    document.body.appendChild(fab);

    // --- WIDGET ---
    const wrap = document.createElement('div');
    wrap.className = 'wa-wrap';
    wrap.style.display = 'none';
    wrap.innerHTML = `
      <div class="wa-card" role="dialog" aria-modal="true" aria-label="${WIDGET_TITLE}">
        <div class="wa-head">${WIDGET_TITLE}</div>
        <div class="wa-body">
          <form id="wa-step1" autocomplete="on">
            <div class="wa-row">
              <label for="wa_nome">Nome completo</label>
              <input id="wa_nome" name="nome" class="wa-input" placeholder="Seu nome completo" required />
              <div class="wa-error" id="wa_err_nome">Informe seu nome completo.</div>
            </div>
            <div class="wa-row">
              <label for="wa_fone">WhatsApp</label>
              <input id="wa_fone" name="fone" class="wa-input" inputmode="tel" placeholder="(DDD) 9 9999-9999" required />
              <div class="wa-error" id="wa_err_fone">Informe um WhatsApp v lido (apenas n meros).</div>
            </div>
            <div class="wa-actions">
              <button type="button" class="wa-btn ghost" id="wa_close1">Fechar</button>
              <button class="wa-btn primary" id="wa_go_step2">Conversar</button>
            </div>
          </form>

          <form id="wa-step2" style="display:none;">
            <div class="wa-row">
              <label for="wa_unidade">Escolha a unidade</label>
              <select id="wa_unidade" name="unidade" class="wa-select" required>
                <option value="" disabled selected>Selecione...</option>
                <option>Boa Vista</option>
                <option>Manaus</option>
                <option>Porto Velho</option>
                <option>Ji-Paran </option>
              </select>
              <div class="wa-error" id="wa_err_unid">Selecione uma unidade.</div>
            </div>
            <div class="wa-actions">
              <button type="button" class="wa-btn ghost" id="wa_back">Voltar</button>
              <button class="wa-btn primary" id="wa_send">Enviar & Abrir WhatsApp</button>
            </div>
          </form>
        </div>
        <div class="wa-foot">Atendimento via WhatsApp   Resposta r pida</div>
      </div>
    `;
    document.body.appendChild(wrap);

    // --- Refs ---
    const nomeEl  = $('#wa_nome', wrap);
    const foneEl  = $('#wa_fone', wrap);
    const step1   = $('#wa-step1', wrap);
    const step2   = $('#wa-step2', wrap);
    const unidadeEl = $('#wa_unidade', wrap);

    const saved = ls.get('wa_lead') || {};
    if (saved.nome) nomeEl.value = saved.nome;
    if (saved.fone) foneEl.value = saved.fone;

    // --- Toggle abrir/minimizar pelo FAB ---
    fab.addEventListener('click', () => {
      if (wrap.style.display === 'block') {
        // Minimiza
        wrap.style.display = 'none';
      } else {
        // Abre
        wrap.style.display = 'block';
        (nomeEl.value ? foneEl : nomeEl).focus();
      }
    });

    // Fecha ao clicar fora
    document.addEventListener('click', (ev) => {
      if (!wrap.contains(ev.target) && !fab.contains(ev.target)) wrap.style.display = 'none';
    });

    // Step 1
    $('#wa_close1', wrap).addEventListener('click', () => { wrap.style.display = 'none'; });
    $('#wa_go_step2', wrap).addEventListener('click', (e) => {
      e.preventDefault();
      const nome = (nomeEl.value||'').trim();
      const fone = stripToDigits(foneEl.value);
      let ok = true;

      $('#wa_err_nome', wrap).style.display = nome.split(' ').length >= 2 ? 'none':'block';
      if (nome.split(' ').length < 2) ok = false;

      $('#wa_err_fone', wrap).style.display = fone.length >= 10 ? 'none':'block';
      if (fone.length < 10) ok = false;

      if (!ok) return;

      ls.set('wa_lead', {nome, fone});
      step1.style.display = 'none';
      step2.style.display = 'block';
      unidadeEl.focus();
    });

    // Step 2
    $('#wa_back', wrap).addEventListener('click', () => {
      step2.style.display = 'none';
      step1.style.display = 'block';
      nomeEl.focus();
    });

    $('#wa_send', wrap).addEventListener('click', async (e) => {
      e.preventDefault();
      const nome = (nomeEl.value||'').trim();
      const fone = stripToDigits(foneEl.value);
      const unidade = unidadeEl.value;

      $('#wa_err_unid', wrap).style.display = unidade ? 'none':'block';
      if (!unidade) return;

      const payload = { name:nome, phone:fone, unit:unidade, page:location.href, timestamp:new Date().toISOString() };
      const res = await postJSON(WEBHOOK_URL, payload);

      // escolher n mero retornado pelo webhook (aceita v rios formatos)
      // { number: "+55..." }  OU  { chosen_number: "+55..." }  OU  { order: ["+55...", ...] }
      let numeroEscolhido = null;

      if (res && (res.number || res.chosen_number)) {
        numeroEscolhido = res.number || res.chosen_number;
      } else if (res && Array.isArray(res.order) && res.order.length) {
        numeroEscolhido = res.order[0];
      } else {
        // fallback local com round-robin
        const list = UNITS_FALLBACK[unidade] || [];
        if (list.length) numeroEscolhido = nextRoundRobin(unidade, list);
      }


      if (numeroEscolhido) {
        const msg = MSG_INICIAL(nome, unidade);
        //postJSON(WEBHOOK_URL, {...payload, chosenNumber: numeroEscolhido, status:'redirecting'}).finally(() => {
          openWhatsappRedirect(numeroEscolhido, msg);
        //});
      } else {
        alert('N o foi poss vel obter um n mero de atendimento. Tente novamente em instantes.');
      }
    });
  }
})();
