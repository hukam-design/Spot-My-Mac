// ===== DATA =====
let SPOTS = [
  { id:1,  num:'1',  name:'Top left',                  size:'L', dims:'9.5 × 5.5 cm', bid:418,  holder:'',  bids:0 },
  { id:2,  num:'2',  name:'Top center',                 size:'L', dims:'9.5 × 5.5 cm', bid:660,  holder:'',  bids:0 },
  { id:3,  num:'3',  name:'Top right',                  size:'L', dims:'9.5 × 5.5 cm', bid:418,  holder:'',  bids:0 },
  { id:4,  num:'4',  name:'Mid left A',                 size:'S', dims:'4 × 5 cm',     bid:139,  holder:'',  bids:0 },
  { id:5,  num:'5',  name:'Mid left B',                 size:'S', dims:'4 × 5 cm',     bid:157,  holder:'',  bids:0 },
  { id:6,  num:'6',  name:'Center — beside Apple logo', size:'L', dims:'9.5 × 5 cm',   bid:555,  holder:'',  bids:0 },
  { id:7,  num:'7',  name:'Mid right A',                size:'S', dims:'4 × 5 cm',     bid:157,  holder:'',  bids:0 },
  { id:8,  num:'8',  name:'Mid right B',                size:'S', dims:'4 × 5 cm',     bid:139,  holder:'',  bids:0 },
  { id:9,  num:'9',  name:'Bottom left',                size:'L', dims:'9.5 × 5.5 cm', bid:209,  holder:'',  bids:0 },
  { id:10, num:'10', name:'Bottom center',              size:'L', dims:'9.5 × 5.5 cm', bid:261,  holder:'',  bids:0 },
  { id:11, num:'11', name:'Bottom right',               size:'L', dims:'9.5 × 5.5 cm', bid:210,  holder:'',  bids:0 },
];



async function fetchSpots() {
  try {
    const res = await fetch('/api/getSpots');
    if (res.ok) {
      const dbSpots = await res.json();
      if (dbSpots && dbSpots.length > 0) {
        SPOTS = dbSpots;
        renderTable();
        updatePrices();
      }
    }
  } catch(e) {
    console.error("Failed to fetch spots from Supabase:", e);
  }
}
// Load real spots from DB immediately
fetchSpots();

// Currency
let currency = 'USD';
let exchangeRate = 1.08; // EUR → USD

function fmt(usdBase) {
  if (currency === 'USD') return `$${usdBase.toLocaleString('en-US')}`;
  const eur = Math.round(usdBase / exchangeRate);
  return `${eur.toLocaleString('fr-FR')} €`;
}

// ===== RENDER TABLE =====
function renderTable() {
  const tbody = document.getElementById('auction-tbody');
  tbody.innerHTML = '';

  // Sort by bid desc
  const sorted = [...SPOTS].sort((a, b) => b.bid - a.bid);

  sorted.forEach(spot => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-spot">
        <div class="spot-row-wrap">
          <span class="spot-id-badge">${spot.num}</span>
          <span class="spot-row-name">${spot.name}</span>
        </div>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;padding:16px 0;">
          <span class="size-badge">${spot.size}</span>
          <span class="size-label">${spot.dims}</span>
        </div>
      </td>
      <td class="col-holder">
        <div style="padding:16px 0;display:flex;align-items:center;gap:8px;">
          ${spot.logo_url && spot.holder
            ? `<img src="${spot.logo_url}" alt="${spot.holder}" style="width:22px;height:22px;object-fit:contain;border-radius:4px;flex-shrink:0;" onerror="this.style.display='none'" /><span class="holder-name">${spot.holder}</span>`
            : spot.holder
              ? `<span class="holder-name">${spot.holder}</span>`
              : `<span class="holder-empty">—</span>`}
        </div>
      </td>
      <td style="text-align:right;padding:16px 20px;">
        <div class="bid-amount" data-price="${spot.bid}">${fmt(spot.bid)}</div>
        <div class="bid-count">${spot.bids} bid${spot.bids !== 1 ? 's' : ''}</div>
        ${spot.underReview ? `<div class="under-review" data-price="${spot.underReview}">${fmt(spot.underReview)} under review</div>` : ''}
      </td>
      <td style="text-align:right;padding:16px 20px;">
        <button class="btn-outbid" data-id="${spot.id}">Outbid</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Attach outbid listeners
  document.querySelectorAll('.btn-outbid').forEach(btn => {
    btn.addEventListener('click', () => openModal(parseInt(btn.dataset.id)));
  });
}

// ===== UPDATE ALL PRICES =====
function updatePrices() {
  // Update Mac lid spots: show logo if approved bid has one, otherwise show price
  SPOTS.forEach(spot => {
    const lidSpot = document.querySelector(`.spot[data-id="${spot.id}"]`);
    if (!lidSpot) return;

    const lidSpotPrice = lidSpot.querySelector('.spot-price');
    let logoEl = lidSpot.querySelector('.spot-logo');

    if (spot.logo_url) {
      // Show logo behind the price label — keep price visible
      if (!logoEl) {
        logoEl = document.createElement('img');
        logoEl.className = 'spot-logo';
        logoEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:6px;border-radius:6px;z-index:0;';
        lidSpot.querySelector('.spot-inner').prepend(logoEl);
      }
      logoEl.src = spot.logo_url;
      logoEl.alt = spot.holder || 'Sponsor logo';
      // Keep price on top
      if (lidSpotPrice) {
        lidSpotPrice.style.display = '';
        lidSpotPrice.style.position = 'relative';
        lidSpotPrice.style.zIndex = '1';
        lidSpotPrice.dataset.price = spot.bid;
      }
    } else {
      // No approved logo — show price, remove any stale logo
      if (lidSpotPrice) {
        lidSpotPrice.style.display = '';
        lidSpotPrice.style.position = '';
        lidSpotPrice.style.zIndex = '';
        lidSpotPrice.dataset.price = spot.bid;
      }
      if (logoEl) logoEl.remove();
    }
  });

  // Total sold is sum of prices ONLY for spots that have been bid on
  const totalSold = SPOTS.reduce((s, sp) => s + (sp.bids > 0 ? sp.bid : 0), 0);
  // Total goal is fixed at $3323 unless totalSold exceeds it
  const totalGoal = Math.max(3323, totalSold || 3323);

  document.getElementById('raised-amount').textContent = fmt(totalSold);
  document.getElementById('progress-goal').textContent = `${fmt(totalGoal)} total`;

  const pct = totalGoal > 0 ? Math.round((totalSold / totalGoal) * 100) : 0;
  const bar = document.getElementById('progress-bar');
  if (bar) bar.style.width = `${pct}%`;

  // Table bid cells
  document.querySelectorAll('[data-price]').forEach(el => {
    const base = parseInt(el.dataset.price);
    el.textContent = fmt(base);
  });

  const clbl = document.getElementById('modal-currency-label');
  if (clbl) clbl.textContent = `Your bid (${currency})`;
  const cicon = document.getElementById('modal-currency-icon');
  if (cicon) cicon.textContent = currency === 'USD' ? '$' : '€';
}

// ===== MODAL =====
let activeSpotId = null;

function openModal(spotId) {
  const spot = SPOTS.find(s => s.id === spotId);
  if (!spot) return;
  activeSpotId = spotId;

  document.getElementById('modal-title').textContent = `Spot ${spot.num} · ${spot.name}`;
  const sizeName = spot.size === 'L' ? 'Large sticker' : 'Small sticker';
  document.getElementById('modal-subtitle').textContent = `${sizeName} · ${spot.dims}`;
  document.getElementById('modal-current-bid').textContent = fmt(spot.bid);
  document.getElementById('modal-current-holder').textContent = `by ${spot.holder || 'Anonymous'} · ${spot.bids} bids`;

  const increment = spot.bids === 0 ? 0 : 1;
  const minBid = spot.bid + increment;
  document.getElementById('modal-hint').textContent = `Minimum ${fmt(minBid)}`;
  
  const bidInput = document.getElementById('bid-amount');
  bidInput.value = minBid;
  bidInput.min = minBid;

  updateDeposit();

  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('bid-amount').focus(), 300);
}

function updateDeposit() {
  let val = parseInt(document.getElementById('bid-amount').value);
  if (isNaN(val)) val = 0;
  
  const deposit = Math.round(val * 0.2);
  const rem = val - deposit;

  const depText1 = document.getElementById('deposit-text-1');
  if (depText1) depText1.textContent = `Deposit, 20% of ${fmt(val)}`;
  const depVal1 = document.getElementById('deposit-val-1');
  if (depVal1) depVal1.textContent = fmt(deposit);
  const depVal2 = document.getElementById('deposit-val-2');
  if (depVal2) depVal2.textContent = fmt(deposit);
  const depRem = document.getElementById('deposit-rem');
  if (depRem) depRem.textContent = fmt(rem);
}

document.getElementById('bid-amount').addEventListener('input', updateDeposit);

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  activeSpotId = null;
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', e => { 
  if (e.key === 'Escape') {
    closeModal();
    document.getElementById('policy-modal-overlay')?.classList.remove('open');
  } 
});

// ===== POLICY MODAL =====
const policyLink = document.getElementById('open-policy');
const policyOverlay = document.getElementById('policy-modal-overlay');
const policyClose = document.getElementById('policy-modal-close');

if (policyLink && policyOverlay) {
  policyLink.addEventListener('click', (e) => {
    e.preventDefault();
    policyOverlay.classList.add('open');
  });
  policyClose?.addEventListener('click', () => {
    policyOverlay.classList.remove('open');
  });
  policyOverlay.addEventListener('click', e => {
    if (e.target === e.currentTarget) policyOverlay.classList.remove('open');
  });
}

let currentLogoBase64 = null;
let currentLogoName = null;
let currentLogoType = null;

const logoFile = document.getElementById('logo-file');
const logoZone = document.getElementById('logo-upload-zone');
const logoTitle = document.getElementById('logo-title');
const logoSub = document.getElementById('logo-sub');

if (logoZone && logoFile) {
  logoZone.addEventListener('click', () => logoFile.click());
  logoFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    currentLogoName = file.name;
    currentLogoType = file.type;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      currentLogoBase64 = ev.target.result;
      logoTitle.textContent = file.name;
      logoTitle.style.color = 'var(--c-blue)';
      logoSub.textContent = 'Click to change';
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById('modal-submit').addEventListener('click', async () => {
  const spot = SPOTS.find(s => s.id === activeSpotId);
  if (!spot) return;
  const val = parseInt(document.getElementById('bid-amount').value);
  const requiredBid = spot.bids === 0 ? spot.bid : spot.bid + 1;
  if (!val || val < requiredBid) {
    document.getElementById('modal-hint').style.color = '#C0392B';
    document.getElementById('modal-hint').textContent = `Bid must be at least ${fmt(requiredBid)}`;
    return;
  }

  const brandName = document.getElementById('brand-name').value;
  const email = document.getElementById('email').value;
  if (!brandName || !email || !email.includes('@')) {
    alert("Brand name and a valid email address (with @) are required.");
    return;
  }
  const website = document.getElementById('website').value;
  const xHandle = document.getElementById('x-handle').value;

  const btn = document.getElementById('modal-submit');
  const originalText = btn.textContent;
  btn.textContent = 'Submitting...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/submitBid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spot_id: spot.id,
        brand_name: brandName,
        email,
        website,
        x_handle: xHandle,
        bid_amount: val,
        logo_base64: currentLogoBase64,
        logo_name: currentLogoName,
        logo_type: currentLogoType
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errorMsg = errData.details ? `${errData.error}: ${errData.details}` : (errData.error || 'Submission failed');
      throw new Error(errorMsg);
    }

    const data = await res.json();

    if (data.checkout_url) {
      window.location.href = data.checkout_url;
      return;
    }

    showSuccessEffect();
    closeModal();
    btn.textContent = originalText;
    btn.disabled = false;
  } catch (err) {
    console.error(err);
    alert(`Failed to submit bid: ${err.message}`);
    btn.textContent = originalText;
    btn.disabled = false;
  }
});

// ===== SUCCESS EFFECT =====
function showSuccessEffect() {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    zIndex: '9999', display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: '0', transition: 'opacity 0.3s ease'
  });

  const modal = document.createElement('div');
  Object.assign(modal.style, {
    background: '#1D1D1F', color: '#fff', padding: '32px', borderRadius: '16px',
    maxWidth: '400px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
    transform: 'scale(0.9) translateY(20px)', transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    border: '1px solid rgba(255,255,255,0.1)'
  });

  modal.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px; animation: modalPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;">🎉</div>
    <h3 style="margin: 0 0 8px; font-size: 20px; font-weight: 600;">Bid submitted!</h3>
    <p style="margin: 0; font-size: 14px; color: #aaa; line-height: 1.5;">
      Thanks for placing your bid. Your submission has been received and is pending review.
    </p>
  `;

  // Inject animation styles if not already present
  if (!document.getElementById('success-anim')) {
    const style = document.createElement('style');
    style.id = 'success-anim';
    style.textContent = `
      @keyframes modalPop {
        0% { transform: scale(0.5); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Trigger animation
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    modal.style.transform = 'scale(1) translateY(0)';
  });

  // Remove after 4.5 seconds
  setTimeout(() => {
    overlay.style.opacity = '0';
    modal.style.transform = 'scale(0.9) translateY(20px)';
    setTimeout(() => overlay.remove(), 400);
  }, 4500);
}

// ===== MACBOOK SPOT CLICKS =====
document.querySelectorAll('.spot[data-id]').forEach(el => {
  el.addEventListener('click', () => {
    const spotId = parseInt(el.dataset.id);
    openModal(spotId);
  });
});

// ===== NAV / HERO CTAs =====
['nav-cta', 'hero-cta'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', () => {
    document.getElementById('auction').scrollIntoView({ behavior: 'smooth' });
  });
});

// ===== CURRENCY TOGGLE =====
document.getElementById('btn-eur').addEventListener('click', () => {
  currency = 'EUR';
  document.getElementById('btn-eur').classList.add('active');
  document.getElementById('btn-usd').classList.remove('active');
  updatePrices();
  if (typeof updateDeposit === 'function') updateDeposit();
});
document.getElementById('btn-usd').addEventListener('click', () => {
  currency = 'USD';
  document.getElementById('btn-usd').classList.add('active');
  document.getElementById('btn-eur').classList.remove('active');
  updatePrices();
  if (typeof updateDeposit === 'function') updateDeposit();
});

let countdownInterval;

async function updateCountdown() {
  let end_at = null;
  try {
    const res = await fetch('/api/getSettings');
    if (res.ok) {
      const data = await res.json();
      if (data.end_at) {
        end_at = new Date(data.end_at);
      }
    }
  } catch(e) {
    console.error("Failed to fetch settings from Supabase:", e);
  }

  function tick() {
    if (!end_at) {
      // If we couldn't load the date, just show something generic or blank
      ['countdown','countdown2'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent='TBD'; });
      return;
    }
    const diff = end_at - Date.now();
    if (diff <= 0) { 
      const cd1 = document.getElementById('countdown');
      if (cd1 && cd1.parentElement) cd1.parentElement.textContent = 'Auction ended';
      
      const cd2 = document.getElementById('countdown2');
      if (cd2 && cd2.parentElement) cd2.parentElement.textContent = 'Auction ended';
      
      if (countdownInterval) clearInterval(countdownInterval);
      return; 
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = `${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`;
    ['countdown','countdown2'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=s; });
  }
  
  tick();
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(tick, 1000);
}

// ===== INIT =====
renderTable();
updateCountdown();
// Ensure progress bar updates correctly on load
updatePrices();

// ===== VISITOR ANALYTICS =====
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getSessionId() {
  let sid = localStorage.getItem('spot_session_id');
  if (!sid) {
    sid = generateUUID();
    localStorage.setItem('spot_session_id', sid);
  }
  return sid;
}

async function pingAnalytics() {
  const sid = getSessionId();
  try {
    const res = await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid })
    });
    if (res.ok) {
      const data = await res.json();
      const activeEl = document.getElementById('active-count');
      const totalEl = document.getElementById('total-count');
      if (activeEl) activeEl.textContent = data.active;
      if (totalEl) totalEl.textContent = data.total;
    }
  } catch (err) {
    console.error('Analytics ping failed', err);
  }
}

// Initial ping
pingAnalytics();
// Ping every 10 seconds (so it falls well within the 20 second threshold)
setInterval(pingAnalytics, 10000);

// ===== CHECK FOR SUCCESS REDIRECT =====
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('success') === 'true') {
    showSuccessEffect();
    // Clean up the URL to prevent showing the success modal again on refresh
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
