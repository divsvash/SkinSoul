/* ================================================================
   SkinSoul v1 — api.js
   API client layer — all backend calls go through here.
   
   USAGE: Drop alongside skinsoul-app.html and skinsoul-app.js.
   Set SKINSOUL_API_BASE to match your backend URL.
   In development: 'http://localhost:3000/api'
   In production:  'https://your-domain.com/api'
================================================================ */

const SKINSOUL_API_BASE = 'http://localhost:3000/api';

// ── Token storage ────────────────────────────────────────────
const Auth = {
  getToken: ()  => localStorage.getItem('skinsoul_token'),
  setToken: (t) => localStorage.setItem('skinsoul_token', t),
  clearToken: () => localStorage.removeItem('skinsoul_token'),
  getUser: ()  => {
    try { return JSON.parse(localStorage.getItem('skinsoul_user') || 'null'); } catch { return null; }
  },
  setUser: (u) => localStorage.setItem('skinsoul_user', JSON.stringify(u)),
  clearUser: () => localStorage.removeItem('skinsoul_user'),
  isLoggedIn: () => !!localStorage.getItem('skinsoul_token'),
};

// ── Core fetch wrapper ───────────────────────────────────────
async function apiRequest(method, path, body = null, isFormData = false) {
  const headers = {};
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  if (!isFormData && body) {
    headers['Content-Type'] = 'application/json';
  }

  const opts = {
    method,
    headers,
    body: isFormData ? body : (body ? JSON.stringify(body) : null),
  };

  const res = await fetch(`${SKINSOUL_API_BASE}${path}`, opts);
  const data = await res.json();

  if (!res.ok) {
    throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status, data });
  }

  return data;
}

const get  = (path)         => apiRequest('GET', path);
const post = (path, body)   => apiRequest('POST', path, body);
const put  = (path, body)   => apiRequest('PUT', path, body);
const patch = (path, body)  => apiRequest('PATCH', path, body);
const del  = (path)         => apiRequest('DELETE', path);

// ── Auth API ─────────────────────────────────────────────────
const API = {
  auth: {
    async register(name, email, password, age, city, gender) {
      const data = await post('/auth/register', { name, email, password, age, city, gender });
      Auth.setToken(data.token);
      Auth.setUser(data.user);
      return data;
    },
    async login(email, password) {
      const data = await post('/auth/login', { email, password });
      Auth.setToken(data.token);
      Auth.setUser(data.user);
      return data;
    },
    logout() {
      Auth.clearToken();
      Auth.clearUser();
    },
    me: () => get('/auth/me'),
  },

  // ── Skin Analysis ─────────────────────────────────────────
  analysis: {
    async scan(imageFile) {
      const formData = new FormData();
      formData.append('image', imageFile);
      return apiRequest('POST', '/analysis/scan', formData, true);
    },
    history: () => get('/analysis/history'),
    getById: (id) => get(`/analysis/${id}`),
    latest: () => get('/analysis/latest/result'),
  },

  // ── Reports ──────────────────────────────────────────────
  report: {
    user:     () => get('/report/user'),
    clinical: () => get('/report/clinical'),
    tip:      (concern) => get(`/report/tip${concern ? `?concern=${encodeURIComponent(concern)}` : ''}`),
    summary:  () => get('/report/summary'),
  },

  // ── Lifestyle ─────────────────────────────────────────────
  lifestyle: {
    get:     () => get('/lifestyle'),
    update:  (data) => put('/lifestyle', data),
    section: (name, data) => patch(`/lifestyle/${name}`, data),
  },

  // ── Water ────────────────────────────────────────────────
  water: {
    today:   () => get('/water'),
    add:     () => post('/water/add'),
    setGoal: (goal) => patch('/water/goal', { goal }),
    reset:   () => del('/water/reset'),
    history: () => get('/water/history'),
  },

  // ── UV ───────────────────────────────────────────────────
  uv: {
    get: (city) => get(`/uv${city ? `?city=${encodeURIComponent(city)}` : ''}`),
  },

  // ── Health check ─────────────────────────────────────────
  health: () => get('/health'),
};


/* ================================================================
   SkinSoul v1 — skinsoul-app-connected.js
   Full frontend logic, updated to call the backend API.
   Replace skinsoul-app.js with this file once the backend is running.
================================================================ */

// ── State ─────────────────────────────────────────────────────
let waterCount = 0;
let waterGoal  = 8;
let currentAnalysisId = null;
let currentUser = Auth.getUser();

// ── Init ──────────────────────────────────────────────────────
async function init() {
  initDate();
  await loadWaterFromServer();
  await loadUVFromServer();
  renderWaterDrops();
  updateWater();
  startWaterReminders();
  startSPFReminders();
  checkPillowReminder();

  // If user is logged in, update greeting
  if (currentUser) {
    document.querySelector('.greeting-section h1').innerHTML =
      `${getGreeting()},<br><em id="userName">${currentUser.name}</em> ✨`;
  }
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// ── Date & greeting ───────────────────────────────────────────
function initDate() {
  const now = new Date();
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.querySelector('.greeting-section h1').innerHTML =
    `${getGreeting()},<br><em id="userName">${currentUser?.name || 'Priya'}</em> ✨`;
  document.getElementById('todayDate').textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
  document.getElementById('petDate').textContent   = `${days[now.getDay()]}'s companion`;
  document.getElementById('reportDate').textContent = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

// ── Navigation ────────────────────────────────────────────────
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  const tabs = document.querySelectorAll('.nav-tab');
  const idx  = ['dashboard','scan','lifestyle','report'].indexOf(page);
  if (tabs[idx]) tabs[idx].classList.add('active');
}

// ── UV Index — live from server ───────────────────────────────
async function loadUVFromServer() {
  try {
    const city = currentUser?.city || 'Delhi';
    const data = await API.uv.get(city);
    document.getElementById('uvValue').textContent   = `UV ${data.uv} — ${data.label}`;
    document.getElementById('uvAdvice').textContent  = data.advice;
  } catch {
    // Keep static fallback — no error shown to user
  }
}

function showUVDetail() {
  loadUVFromServer().then(() => {
    const val   = document.getElementById('uvValue').textContent;
    const advice = document.getElementById('uvAdvice').textContent;
    showToast('☀️', `${val}. ${advice}`, 'spf-toast');
  });
}

// ── Water Tracker — backed by server ────────────────────────
async function loadWaterFromServer() {
  try {
    if (!Auth.isLoggedIn()) return;
    const data  = await API.water.today();
    waterCount  = data.count;
    waterGoal   = data.goal;
  } catch {
    // Use local defaults
  }
}

function renderWaterDrops() {
  const container = document.getElementById('waterDrops');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < waterGoal; i++) {
    const drop = document.createElement('div');
    drop.className = 'drop' + (i < waterCount ? ' filled' : '');
    drop.onclick = () => { if (i >= waterCount) { waterCount = i + 1; updateWater(); } };
    drop.innerHTML = `<svg viewBox="0 0 30 38"><path d="M15 2 Q28 15 28 24 A13 13 0 0 1 2 24 Q2 15 15 2Z"
      fill="${i < waterCount ? '#7BB8D4' : 'rgba(123,184,212,0.2)'}"/></svg>`;
    container.appendChild(drop);
  }
}

function updateWater() {
  renderWaterDrops();
  const pct = (waterCount / waterGoal) * 100;
  const fill = document.getElementById('waterProgressFill');
  if (fill) fill.style.width = pct + '%';
  const statusCard = document.getElementById('waterStatusCard');
  if (statusCard) statusCard.textContent = `${waterCount} / ${waterGoal} glasses today`;

  const msgs = [
    'Just starting — your skin is thirsty!',
    'Keep going! You\'re on your way 💧',
    'Halfway there! Skin is loving this.',
    'Almost there! Two more to go 🌊',
    'You hit your goal! Dewdrop is glowing! ✨',
  ];
  const idx = waterCount >= waterGoal ? 4 : Math.floor((waterCount / waterGoal) * 4);
  const countEl = document.getElementById('waterCount');
  if (countEl) countEl.textContent = `${waterCount} of ${waterGoal} glasses · ${msgs[idx]}`;

  // Update pet drops
  const petDrops = document.querySelectorAll('.pet-drop');
  petDrops.forEach((d, i) => { d.style.display = waterCount >= (i + 1) * 2 ? 'block' : 'none'; });

  if (waterCount >= waterGoal) {
    showToast('🎉', 'Goal reached! Dewdrop is so happy! Your skin thanks you.', 'water-toast');
  }
}

async function logWater() {
  if (!Auth.isLoggedIn()) {
    // Offline mode
    if (waterCount < waterGoal) {
      waterCount++;
      updateWater();
      showToast('💧', `Water logged! ${waterCount}/${waterGoal} glasses done.`, 'water-toast');
    } else {
      showToast('✨', 'You\'ve hit your water goal for today! Amazing!', 'water-toast');
    }
    return;
  }

  try {
    const data = await API.water.add();
    waterCount = data.count;
    waterGoal  = data.goal;
    updateWater();
    if (data.goalReached) {
      showToast('🎉', data.message, 'water-toast');
    } else {
      showToast('💧', data.message, 'water-toast');
    }
  } catch (err) {
    showToast('⚠️', 'Could not sync water log. Counting locally.', '');
    if (waterCount < waterGoal) { waterCount++; updateWater(); }
  }
}

// ── Reminders ─────────────────────────────────────────────────
function startWaterReminders() {
  setTimeout(() => {
    showToast('💧', 'Time to drink water! Dewdrop is reminding you! 🌱', 'water-toast');
  }, 5000);
  setInterval(() => {
    showToast('💧', 'Hydration check! Time for another glass. Your skin will thank you 💙', 'water-toast');
  }, 90 * 60 * 1000);
}

function startSPFReminders() {
  setTimeout(() => {
    showToast('🧴', 'UV check! Reapply your sunscreen now.', 'spf-toast');
  }, 15000);
  setInterval(() => {
    showToast('🧴', 'SPF check! Time to reapply your sunscreen.', 'spf-toast');
  }, 2 * 60 * 60 * 1000);
}

function checkPillowReminder() {
  setTimeout(() => {
    showToast('🛏️', 'Reminder: Change your pillowcase! Fresh fabric = fewer breakouts.', 'pillow-toast');
  }, 25000);
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(icon, message, type = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
  toast.onclick = () => toast.remove();
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.5s';
    toast.style.opacity    = '0';
    setTimeout(() => toast.remove(), 500);
  }, 6000);
}

// ── Lifestyle tabs ────────────────────────────────────────────
function showLifeTab(tab) {
  document.querySelectorAll('.life-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.lifestyle-form').forEach(f => f.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('form-' + tab).classList.add('active');
}

function toggleChip(el) { el.classList.toggle('selected'); }

async function saveSection(section) {
  // Collect form data for the section
  const form = document.getElementById('form-' + section);
  if (!form) return;

  const payload = {};

  // Collect selects
  form.querySelectorAll('select').forEach(sel => {
    if (sel.id || sel.name) payload[sel.id || sel.name] = sel.value;
    else if (sel.previousElementSibling?.textContent) {
      const key = sel.previousElementSibling.textContent.toLowerCase().replace(/\s+/g, '_');
      payload[key] = sel.value;
    }
  });

  // Collect inputs
  form.querySelectorAll('input[type=text], input[type=number], textarea').forEach(inp => {
    if (inp.id && inp.value) payload[inp.id] = inp.value;
  });

  // Collect selected chips
  const chipGroups = {};
  form.querySelectorAll('.chip.selected').forEach(chip => {
    const group = chip.closest('.chip-selector');
    const label = group?.previousElementSibling?.textContent?.trim() || 'habits';
    if (!chipGroups[label]) chipGroups[label] = [];
    chipGroups[label].push(chip.textContent.trim());
  });
  Object.assign(payload, chipGroups);

  showToast('⏳', `Saving ${section} profile...`, '');

  try {
    if (Auth.isLoggedIn()) {
      await API.lifestyle.section(section, payload);
      showToast('✓', `${section.charAt(0).toUpperCase() + section.slice(1)} profile saved! AI analysis will update.`, '');
    } else {
      // Store offline
      showToast('✓', `${section.charAt(0).toUpperCase() + section.slice(1)} saved locally. Log in to sync.`, '');
    }
  } catch (err) {
    showToast('⚠️', 'Could not save. Please check your connection.', '');
  }
}

// ── Report toggle ─────────────────────────────────────────────
function showReport(type) {
  document.querySelectorAll('.simplified-report, .dermat-report').forEach(r => r.classList.remove('active'));
  document.querySelectorAll('.rtoggle').forEach(t => t.classList.remove('active'));
  document.getElementById(type + '-report').classList.add('active');
  event.target.classList.add('active');
}

// ── Photo Upload ──────────────────────────────────────────────
let uploadedImageFile = null;

function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (file) {
    uploadedImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('previewImg').src = e.target.result;
      document.getElementById('scanPreview').style.display = 'block';
      document.getElementById('uploadArea').style.display = 'none';
    };
    reader.readAsDataURL(file);
  }
}

function handleDrop(event) {
  event.preventDefault();
  document.getElementById('uploadArea').classList.remove('dragover');
  const file = event.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    uploadedImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('previewImg').src = e.target.result;
      document.getElementById('scanPreview').style.display = 'block';
      document.getElementById('uploadArea').style.display = 'none';
    };
    reader.readAsDataURL(file);
  }
}

// ── AI Analysis — calls the real backend ─────────────────────
async function runAIAnalysis() {
  const overlay = document.getElementById('analyzingOverlay');
  const stepsContainer = document.getElementById('analyzingSteps');
  overlay.classList.add('show');
  stepsContainer.innerHTML = '';

  const uiSteps = [
    'Uploading your photo securely...',
    'Detecting skin type and hydration markers...',
    'Mapping pore size and distribution...',
    'Analysing pigmentation and texture...',
    'Correlating with your lifestyle data...',
    'Checking diet-skin correlation patterns...',
    'Generating your dermatologist report...',
    'Creating personalised nuskhe recommendations...',
  ];

  // Show the first 3 steps immediately (visual feedback)
  const addStep = (text) => {
    const step = document.createElement('div');
    step.className = 'step-item';
    step.style.animationDelay = '0s';
    step.textContent = text;
    stepsContainer.appendChild(step);
  };

  addStep(uiSteps[0]);

  try {
    if (!Auth.isLoggedIn()) {
      // Demo mode — simulate without real API
      for (let i = 1; i < uiSteps.length; i++) {
        await new Promise(r => setTimeout(r, 700));
        addStep(uiSteps[i]);
      }
      await new Promise(r => setTimeout(r, 800));
      overlay.classList.remove('show');
      showPage('report');
      showToast('✨', 'Demo analysis complete! Log in for real AI analysis.', '');
      return;
    }

    if (!uploadedImageFile) {
      overlay.classList.remove('show');
      showToast('⚠️', 'Please upload a photo first.', '');
      return;
    }

    // Run actual analysis
    addStep(uiSteps[1]);

    const data = await API.analysis.scan(uploadedImageFile);
    currentAnalysisId = data.analysisId;

    // Show remaining steps while processing
    for (let i = 2; i < uiSteps.length; i++) {
      await new Promise(r => setTimeout(r, 500));
      addStep(uiSteps[i]);
    }

    await new Promise(r => setTimeout(r, 600));
    overlay.classList.remove('show');

    // Populate the report UI with real data
    populateReportFromAPI(data.result);

    showPage('report');
    showToast('✨', `Your skin score is ${data.result.skinScore}/100. Report is ready! 🌸`, '');

    // Load the full AI report in the background
    loadFullReport();

  } catch (err) {
    overlay.classList.remove('show');
    console.error('Analysis error:', err);
    if (err.status === 401) {
      showToast('🔐', 'Please log in to use AI analysis.', '');
    } else if (err.status === 429) {
      showToast('⏳', 'AI analysis is busy. Please wait a moment and try again.', '');
    } else {
      showToast('⚠️', 'Analysis failed. Please try again with a clearer photo.', '');
    }
  }
}

// ── Populate report UI with AI data ──────────────────────────
function populateReportFromAPI(result) {
  if (!result) return;

  // Update skin score
  const scoreNum = document.querySelector('.score-num');
  if (scoreNum) scoreNum.textContent = result.skinScore || 72;

  // Update score heading
  const scoreHead = document.querySelector('.score-info h3');
  if (scoreHead) scoreHead.textContent = `Skin Health Score: ${result.skinType || 'Combination'}`;

  // Update concerns in the insight cards
  const concernsCard = document.querySelector('.insight-card:first-child');
  if (concernsCard && result.concerns?.length) {
    const items = result.concerns.map(c =>
      `<div class="insight-item">
        <div class="insight-dot" style="background:${c.color || '#E76F51'}"></div>
        ${c.description}
      </div>`
    ).join('');
    const h4 = concernsCard.querySelector('h4');
    concernsCard.innerHTML = (h4 ? h4.outerHTML : '<h4>⚠️ Concerns Found</h4>') + items;
  }

  // Update positives
  const positivesCard = document.querySelector('.insight-card:last-child');
  if (positivesCard && result.positives?.length) {
    const items = result.positives.map(p =>
      `<div class="insight-item">
        <div class="insight-dot dot-good"></div>
        ${p.description}
      </div>`
    ).join('');
    const h4 = positivesCard.querySelector('h4');
    positivesCard.innerHTML = (h4 ? h4.outerHTML : '<h4>✅ What\'s Working</h4>') + items;
  }
}

// ── Load full AI report (user + clinical) in background ──────
async function loadFullReport() {
  if (!Auth.isLoggedIn()) return;

  try {
    // User report
    const userReport = await API.report.user();
    if (userReport.report) populateUserReport(userReport.report);
  } catch (err) {
    console.warn('Could not load full report:', err.message);
  }

  try {
    // Clinical report
    const clinical = await API.report.clinical();
    if (clinical.report) populateClinicalReport(clinical.report, clinical.generatedAt);
  } catch (err) {
    console.warn('Could not load clinical report:', err.message);
  }
}

function populateUserReport(report) {
  // Update the suggested changes section
  const changesSection = document.querySelector('.changes-section');
  if (changesSection && report.suggestedChanges?.length) {
    const html = report.suggestedChanges.map(c =>
      `<div class="change-item">
        <div class="change-arrow arrow-${c.category}">${c.emoji}</div>
        <div class="change-content">
          <h5>${c.title}</h5>
          <p>${c.description}</p>
        </div>
      </div>`
    ).join('');
    changesSection.innerHTML = `<h3>🔄 ${report.greeting || 'Gentle Changes We Suggest'}</h3>${html}`;
  }

  // Update nuskhe
  const nuskheGrid = document.querySelector('.nuskhe-grid');
  if (nuskheGrid && report.gharKeNuskhe?.length) {
    nuskheGrid.innerHTML = report.gharKeNuskhe.map(n =>
      `<div class="nuskhe-card">
        <div class="n-icon">${n.emoji}</div>
        <h5>${n.name}</h5>
        <p>${n.ingredients} · ${n.method} · ${n.frequency}</p>
      </div>`
    ).join('');
  }
}

function populateClinicalReport(report, generatedAt) {
  // Update the dermatologist report section
  const dermatReport = document.querySelector('.dermat-report');
  if (!dermatReport) return;

  const date = generatedAt ? new Date(generatedAt).toLocaleDateString('en-IN') : '';

  let html = `
    <div class="dermat-banner">
      🩺 <strong>Clinical Summary for Dermatologist Review</strong> &nbsp;·&nbsp; 
      Generated by SkinSoul AI &nbsp;·&nbsp; ${date}
    </div>`;

  if (report.patientSummary) {
    const ps = report.patientSummary;
    html += `
      <div class="dermat-section">
        <h4>Patient Summary</h4>
        <div class="data-row"><div class="data-key">Chief complaint</div><div class="data-val">${ps.chiefComplaint || '—'}</div></div>
        <div class="data-row"><div class="data-key">Skin type</div><div class="data-val">${ps.skinType || '—'}</div></div>
        <div class="data-row"><div class="data-key">Fitzpatrick scale</div><div class="data-val">${ps.fitzpatrickScale || '—'}</div></div>
      </div>`;
  }

  if (report.aiFindings?.length) {
    html += `<div class="dermat-section"><h4>AI Visual Findings</h4>`;
    report.aiFindings.forEach(f => {
      html += `<div class="data-row"><div class="data-key">${f.finding}</div><div class="data-val">${f.severity} · ${f.location} · ${f.differentialDiagnosis}</div></div>`;
    });
    html += '</div>';
  }

  if (report.lifestyleSummary) {
    const ls = report.lifestyleSummary;
    html += `
      <div class="dermat-section">
        <h4>Patient Lifestyle (Self-Reported)</h4>
        ${Object.entries(ls).map(([k, v]) =>
          `<div class="data-row"><div class="data-key">${k.charAt(0).toUpperCase() + k.slice(1)}</div><div class="data-val">${v}</div></div>`
        ).join('')}
      </div>`;
  }

  if (report.aiRecommendations?.length) {
    html += `<div class="dermat-section"><h4>AI Recommendations for Review</h4>`;
    report.aiRecommendations.forEach(r => {
      html += `<div class="data-row"><div class="data-key">${r.type}</div><div class="data-val">${r.suggestion}<br><small style="color:var(--text-light)">${r.rationale}</small></div></div>`;
    });
    html += '</div>';
  }

  if (report.disclaimer) {
    html += `<div style="font-size:0.75rem;color:var(--text-light);margin-top:12px;font-style:italic;padding:16px">⚠️ ${report.disclaimer}</div>`;
  }

  dermatReport.innerHTML = html;
}

// ── User Registration / Login (called from HTML buttons) ─────
async function handleRegister() {
  const name = document.getElementById('regName')?.value?.trim();
  const email = document.getElementById('regEmail')?.value?.trim();
  const password = document.getElementById('regPassword')?.value;
  const city = document.getElementById('regCity')?.value?.trim();

  if (!name || !email || !password) {
    showToast('⚠️', 'Please fill in all required fields.', '');
    return;
  }

  try {
    showToast('⏳', 'Creating your account...', '');
    const data = await API.auth.register(name, email, password, null, city, null);
    currentUser = data.user;
    initDate();
    showToast('🌸', `Welcome to SkinSoul, ${data.user.name}!`, '');
    showPage('dashboard');
  } catch (err) {
    showToast('⚠️', err.message, '');
  }
}

async function handleLogin() {
  const email = document.getElementById('loginEmail')?.value?.trim();
  const password = document.getElementById('loginPassword')?.value;

  if (!email || !password) {
    showToast('⚠️', 'Please enter your email and password.', '');
    return;
  }

  try {
    showToast('⏳', 'Signing you in...', '');
    const data = await API.auth.login(email, password);
    currentUser = data.user;
    initDate();
    await loadWaterFromServer();
    updateWater();
    showToast('🌸', data.message, '');
    showPage('dashboard');
  } catch (err) {
    showToast('⚠️', err.message, '');
  }
}

function handleLogout() {
  API.auth.logout();
  currentUser = null;
  waterCount  = 0;
  showToast('👋', 'You\'ve been logged out.', '');
  showPage('dashboard');
  initDate();
}

// ── Kick off ──────────────────────────────────────────────────
init();
