/* ================================================================
   SkinSoul v1 — Main JavaScript
   Handles: page navigation, water tracker, drop render,
            photo upload, AI analysis overlay, lifestyle tabs,
            report toggle, toasts, water/SPF/pillow reminders
================================================================ */

// ===== STATE =====
  let waterCount = 5;
  const waterGoal = 8;
  let waterTimerInterval = null;
  let pillowDays = 2; // days since last change
  let spfLastApplied = Date.now() - (90 * 60 * 1000); // 1.5h ago to demo

  // ===== NAVIGATION =====
  function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    const tabs = document.querySelectorAll('.nav-tab');
    const idx = ['dashboard','scan','lifestyle','report'].indexOf(page);
    tabs[idx].classList.add('active');
  }

  // ===== DATE =====
  function initDate() {
    const now = new Date();
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
    document.querySelector('.greeting-section h1').innerHTML = `${greeting},<br><em id="userName">Priya</em> ✨`;
    document.getElementById('todayDate').textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
    document.getElementById('petDate').textContent = `${days[now.getDay()]}'s companion`;
    document.getElementById('reportDate').textContent = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }

  // ===== WATER TRACKER =====
  function renderWaterDrops() {
    const container = document.getElementById('waterDrops');
    container.innerHTML = '';
    for (let i = 0; i < waterGoal; i++) {
      const drop = document.createElement('div');
      drop.className = 'drop' + (i < waterCount ? ' filled' : '');
      drop.onclick = () => { if (i >= waterCount) { waterCount = i + 1; updateWater(); } };
      drop.innerHTML = `<svg viewBox="0 0 30 38"><path d="M15 2 Q28 15 28 24 A13 13 0 0 1 2 24 Q2 15 15 2Z" fill="${i < waterCount ? '#7BB8D4' : 'rgba(123,184,212,0.2)'}"/></svg>`;
      container.appendChild(drop);
    }
  }

  function updateWater() {
    renderWaterDrops();
    const pct = (waterCount / waterGoal) * 100;
    document.getElementById('waterProgressFill').style.width = pct + '%';
    document.getElementById('waterStatusCard').textContent = `${waterCount} / ${waterGoal} glasses today`;

    const msgs = ['Just starting — your skin is thirsty!','Keep going! You\'re on your way 💧','Halfway there! Skin is loving this.','Almost there! Two more to go 🌊','You hit your goal! Dewdrop is glowing! ✨'];
    const msgIdx = waterCount >= waterGoal ? 4 : Math.floor((waterCount/waterGoal)*4);
    document.getElementById('waterCount').textContent = `${waterCount} of ${waterGoal} glasses · ${msgs[msgIdx]}`;

    // Update pet drops
    const petDrops = document.querySelectorAll('.pet-drop');
    petDrops.forEach((d, i) => { d.style.display = waterCount >= (i+1)*2 ? 'block' : 'none'; });

    if (waterCount >= waterGoal) {
      showToast('🎉', 'Goal reached! Dewdrop is so happy! Your skin thanks you.', 'water-toast');
    }
  }

  function logWater() {
    if (waterCount < waterGoal) {
      waterCount++;
      updateWater();
      showToast('💧', 'Water logged! ' + waterCount + '/' + waterGoal + ' glasses done.', 'water-toast');
    } else {
      showToast('✨', 'You\'ve hit your water goal for today! Amazing!', 'water-toast');
    }
  }

  // ===== WATER REMINDER (every 90 min) =====
  function startWaterReminders() {
    // Demo: show first reminder after 5 seconds
    setTimeout(() => {
      showToast('💧', 'Time to drink water! It\'s been 1.5 hours. Dewdrop is reminding you! 🌱', 'water-toast');
    }, 5000);
    // Then every 90 minutes (90*60*1000 ms)
    setInterval(() => {
      showToast('💧', 'Hydration check! Time for another glass. Your skin will thank you 💙', 'water-toast');
    }, 90 * 60 * 1000);
  }

  // ===== SPF REMINDER (every 2 hours) =====
  function startSPFReminders() {
    setTimeout(() => {
      showToast('🧴', 'UV 8 today in Delhi! Reapply your sunscreen now. Don\'t let those rays win!', 'spf-toast');
    }, 15000);
    setInterval(() => {
      showToast('🧴', 'SPF check! Time to reapply your sunscreen. UV is still high outside.', 'spf-toast');
    }, 2 * 60 * 60 * 1000);
  }

  // ===== PILLOW REMINDER =====
  function checkPillowReminder() {
    if (pillowDays >= 2) {
      setTimeout(() => {
        showToast('🛏️', 'Reminder: Change your pillowcase today! It\'s been ' + pillowDays + ' days. Fresh pillowcase = fewer breakouts!', 'pillow-toast');
      }, 25000);
    }
  }

  // ===== TOAST =====
  function showToast(icon, message, type = '') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
    toast.onclick = () => toast.remove();
    container.appendChild(toast);
    setTimeout(() => { toast.style.transition = 'opacity 0.5s'; toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 6000);
  }

  // ===== LIFESTYLE TABS =====
  function showLifeTab(tab) {
    document.querySelectorAll('.life-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.lifestyle-form').forEach(f => f.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('form-' + tab).classList.add('active');
  }

  function toggleChip(el) { el.classList.toggle('selected'); }

  function saveSection(section) {
    showToast('✓', section.charAt(0).toUpperCase() + section.slice(1) + ' profile saved! Your AI analysis is updating.', '');
  }

  // ===== REPORT TOGGLE =====
  function showReport(type) {
    document.querySelectorAll('.simplified-report, .dermat-report').forEach(r => r.classList.remove('active'));
    document.querySelectorAll('.rtoggle').forEach(t => t.classList.remove('active'));
    document.getElementById(type + '-report').classList.add('active');
    event.target.classList.add('active');
  }

  // ===== PHOTO UPLOAD =====
  function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (file) {
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
      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById('previewImg').src = e.target.result;
        document.getElementById('scanPreview').style.display = 'block';
        document.getElementById('uploadArea').style.display = 'none';
      };
      reader.readAsDataURL(file);
    }
  }

  // ===== AI ANALYSIS =====
  async function runAIAnalysis() {
    const overlay = document.getElementById('analyzingOverlay');
    const stepsContainer = document.getElementById('analyzingSteps');
    overlay.classList.add('show');
    stepsContainer.innerHTML = '';

    const steps = [
      'Detecting skin type and hydration markers...',
      'Mapping pore size and distribution...',
      'Analyzing pigmentation and texture...',
      'Correlating with your lifestyle data...',
      'Checking diet-skin correlation patterns...',
      'Generating dermatologist report...',
      'Creating personalized nuskhe recommendations...',
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 700));
      const step = document.createElement('div');
      step.className = 'step-item';
      step.style.animationDelay = '0s';
      step.textContent = steps[i];
      stepsContainer.appendChild(step);
    }

    await new Promise(r => setTimeout(r, 800));
    overlay.classList.remove('show');
    showPage('report');
    showToast('✨', 'Your skin analysis is ready! Scroll through your personalized report.', '');
  }

  // ===== UV INFO =====
  function showUVDetail() {
    showToast('☀️', 'UV Index 8 today in Delhi. Wear SPF 50+, a hat, and try to avoid 11am-3pm sun. Reapply every 2 hours!', 'spf-toast');
  }

  // ===== INIT =====
  function init() {
    initDate();
    renderWaterDrops();
    updateWater();
    startWaterReminders();
    startSPFReminders();
    checkPillowReminder();
  }

  init();