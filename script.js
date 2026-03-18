// ============================================================
// GenAI Resume Analyzer — Wizard Script
// API connection: coming in the next step
// ============================================================

// ── Element refs ──────────────────────────────────────────────
const form        = document.getElementById('analyzeForm');
const analyzeBtn  = document.getElementById('analyzeBtn');
const outputArea  = document.getElementById('outputArea');

const tabUpload     = document.getElementById('tab-upload');
const tabPaste      = document.getElementById('tab-paste');
const panelUpload   = document.getElementById('panel-upload');
const panelPaste    = document.getElementById('panel-paste');
const uploadZone    = document.getElementById('uploadZone');
const fileInput     = document.getElementById('resumeFile');
const uploadIdle    = document.getElementById('uploadIdle');
const uploadPreview = document.getElementById('uploadPreview');
const fileName      = document.getElementById('fileName');
const fileSize      = document.getElementById('fileSize');
const fileTypeIcon  = document.getElementById('fileTypeIcon');
const removeFileBtn = document.getElementById('removeFile');
const uploadHint    = document.getElementById('uploadHint');
const resumeText    = document.getElementById('resumeText');
const resumeHint    = document.getElementById('resumeHint');

let activeMode     = 'upload'; // 'upload' | 'paste'
let uploadedFile   = null;
let currentSection = 1;
let advanceTimers  = {};       // debounce handles per section

// ── Wizard navigation ─────────────────────────────────────────
const SECTIONS = ['section-a', 'section-b'];

function showSection(n) {
  SECTIONS.forEach((id, i) => {
    const el = document.getElementById(id);
    if (i === n - 1) {
      el.classList.remove('wizard-card--hidden');
      // Small delay so animation triggers after display change
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } else {
      el.classList.add('wizard-card--hidden');
    }
  });
  currentSection = n;
  setStep(n);
}

document.getElementById('backToA').addEventListener('click', () => {
  cancelAutoAdvance(1);
  showSection(1);
});


// ── Auto-advance logic ────────────────────────────────────────
const ADVANCE_DELAY = 700; // ms — pause before moving to next section

function cancelAutoAdvance(fromSection) {
  clearTimeout(advanceTimers[fromSection]);
  const hint = document.getElementById(`hint${String.fromCharCode(64 + fromSection)}`);
  if (hint) { hint.classList.remove('visible'); hint.innerHTML = ''; }
}

function scheduleAdvance(fromSection) {
  cancelAutoAdvance(fromSection); // reset any existing timer

  const hintId = `hint${String.fromCharCode(64 + fromSection)}`; // hintA, hintB
  const hint = document.getElementById(hintId);

  // Show the progress bar hint
  hint.innerHTML = `
    <span>&#10003; Looks good!</span>
    <div class="advance-bar-wrap">
      <div class="advance-bar" id="bar${fromSection}"></div>
    </div>`;
  hint.classList.add('visible');

  // Animate the bar over ADVANCE_DELAY
  requestAnimationFrame(() => {
    const bar = document.getElementById(`bar${fromSection}`);
    if (bar) {
      bar.style.transition = `width ${ADVANCE_DELAY}ms linear`;
      bar.style.width = '100%';
    }
  });

  advanceTimers[fromSection] = setTimeout(() => {
    hint.classList.remove('visible');
    showSection(fromSection + 1);
  }, ADVANCE_DELAY);
}

// Section 1 is complete when: file uploaded OR >= 20 words pasted
function isSectionOneDone() {
  if (activeMode === 'upload') return !!uploadedFile;
  const words = resumeText.value.trim().split(/\s+/).filter(Boolean).length;
  return words >= 20;
}

// Section 2 is complete when: URL entered OR >= 15 words pasted
function isSectionTwoDone() {
  const url  = document.getElementById('jobUrl').value.trim();
  const desc = document.getElementById('jobDescription').value.trim();
  const words = desc.split(/\s+/).filter(Boolean).length;
  return url.length > 0 || words >= 15;
}

// ── Full form submit (from section C) ────────────────────────
form.addEventListener('submit', (e) => {
  e.preventDefault();

  const payload = {
    resumeMode:      activeMode,
    resumeFile:      activeMode === 'upload' ? uploadedFile : null,
    resumeText:      activeMode === 'paste'  ? resumeText.value.trim() : '',
    jobUrl:          document.getElementById('jobUrl').value.trim(),
    jobDescription:  document.getElementById('jobDescription').value.trim(),
    extraContext:    document.getElementById('extraContext').value.trim(),
  };

  console.log('Form data ready for API:', {
    ...payload,
    resumeFile: payload.resumeFile
      ? `${payload.resumeFile.name} (${formatBytes(payload.resumeFile.size)})`
      : null,
  });

  // Hide the form, show loading
  document.getElementById('section-b').classList.add('wizard-card--hidden');
  setStep(3);
  setLoadingState(true);
  simulatePlaceholderResponse(); // TODO: replace with Claude API call
});

// ── Tab switching (Upload / Paste) ────────────────────────────
function switchTab(mode) {
  activeMode = mode;
  if (mode === 'upload') {
    tabUpload.classList.add('input-tab--active');
    tabUpload.setAttribute('aria-selected', 'true');
    tabPaste.classList.remove('input-tab--active');
    tabPaste.setAttribute('aria-selected', 'false');
    panelUpload.style.display = '';
    panelPaste.style.display = 'none';
  } else {
    tabPaste.classList.add('input-tab--active');
    tabPaste.setAttribute('aria-selected', 'true');
    tabUpload.classList.remove('input-tab--active');
    tabUpload.setAttribute('aria-selected', 'false');
    panelPaste.style.display = '';
    panelUpload.style.display = 'none';
    resumeText.focus();
  }
}

tabUpload.addEventListener('click', () => switchTab('upload'));
tabPaste.addEventListener('click',  () => switchTab('paste'));

// ── Live word count + auto-advance for paste mode ─────────────
resumeText.addEventListener('input', () => {
  const words = resumeText.value.trim().split(/\s+/).filter(Boolean).length;
  resumeHint.textContent = words > 0 ? `${words} word${words !== 1 ? 's' : ''} — need 20 to continue` : '';
  if (words >= 20) {
    resumeHint.textContent = `${words} words ✓`;
    if (currentSection === 1) scheduleAdvance(1);
  } else {
    cancelAutoAdvance(1);
  }
});

// ── File helpers ──────────────────────────────────────────────
function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'pdf')              return '&#128196;';
  if (ext === 'doc' || ext === 'docx') return '&#128209;';
  return '&#128462;';
}

function formatBytes(bytes) {
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function showFilePreview(file) {
  uploadedFile = file;
  uploadIdle.style.display = 'none';
  uploadPreview.style.display = 'flex';
  uploadZone.classList.add('has-file');
  fileTypeIcon.innerHTML = getFileIcon(file.name);
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  uploadHint.textContent = '';
  // Auto-advance after file upload
  if (currentSection === 1) scheduleAdvance(1);
}

function clearFile() {
  uploadedFile = null;
  fileInput.value = '';
  uploadIdle.style.display = '';
  uploadPreview.style.display = 'none';
  uploadZone.classList.remove('has-file');
  uploadHint.textContent = '';
  cancelAutoAdvance(1);
}

removeFileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  clearFile();
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (!uploadedFile) uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', (e) => {
  if (!uploadZone.contains(e.relatedTarget)) uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  if (!uploadedFile && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

uploadZone.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && !uploadedFile) {
    e.preventDefault();
    fileInput.click();
  }
});

const ALLOWED_EXTS = ['pdf', 'doc', 'docx', 'txt'];
const MAX_SIZE_MB  = 10;

function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) {
    uploadHint.innerHTML = '<span style="color:#e74c3c">⚠ Unsupported format. Please upload PDF, DOC, DOCX, or TXT.</span>';
    return;
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    uploadHint.innerHTML = `<span style="color:#e74c3c">⚠ File too large. Max size is ${MAX_SIZE_MB} MB.</span>`;
    return;
  }
  showFilePreview(file);
}

// ── Step progress bar ─────────────────────────────────────────
const TOTAL_STEPS = 4;
const STEP_NAMES  = ['Your Resume', 'Add the Job', 'Resume Versions', 'Get GapLift'];

function setStep(stepNum) {
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const el = document.getElementById(`step-${i}`);
    if (!el) continue;
    el.classList.remove('step--active', 'step--done');
    if (i < stepNum)        el.classList.add('step--done');
    else if (i === stepNum) el.classList.add('step--active');
  }
  for (let i = 1; i <= TOTAL_STEPS - 1; i++) {
    const conn = document.getElementById(`conn-${i}`);
    if (conn) conn.classList.toggle('conn--done', i < stepNum);
  }
  // Mobile label
  const mobileLabel = document.getElementById('stepsMobileLabel');
  if (mobileLabel) {
    mobileLabel.textContent = `Step ${stepNum} of ${TOTAL_STEPS} — ${STEP_NAMES[stepNum - 1]}`;
  }
}

// ── Inline field error ────────────────────────────────────────
function showFieldError(field, message) {
  field.classList.add('error');
  field.focus();
  const existing = field.parentNode.querySelector('.error-message');
  if (existing) existing.remove();
  const msg = document.createElement('span');
  msg.className = 'error-message';
  msg.textContent = '⚠ ' + message;
  field.insertAdjacentElement('afterend', msg);
}

document.querySelectorAll('.input, .textarea').forEach(el => {
  el.addEventListener('input', () => {
    el.classList.remove('error');
    const sib = el.nextElementSibling;
    if (sib && sib.classList.contains('error-message')) sib.remove();
  });
});

// Section B has no auto-advance — user clicks Analyze to submit

// ── Loading state ─────────────────────────────────────────────
function setLoadingState(isLoading) {
  if (isLoading) {
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span class="btn-icon">&#8987;</span> Analyzing with Claude...';
    outputArea.classList.remove('active');
    outputArea.innerHTML = `
      <div class="output-placeholder">
        <div class="output-icon">&#8987;</div>
        <p class="output-placeholder-title">Claude is working on your resume...</p>
        <p class="output-placeholder-sub">This usually takes 15–30 seconds. Hang tight!</p>
      </div>`;
    outputArea.style.display = '';
    outputArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = '<span class="btn-icon">&#10024;</span> Analyze &amp; Generate My Resume';
  }
}

// ── Placeholder response ──────────────────────────────────────
const SAMPLE_TECH_SKILLS = [
  { name: 'SQL & Data Analysis',       priority: 'high',   reason: 'The role requires pulling reports from the database directly — mentioned 3 times in the JD.' },
  { name: 'Python (basic scripting)',   priority: 'high',   reason: 'Automation of repetitive ops tasks is expected; even basic scripts will set you apart.' },
  { name: 'Tableau / Power BI',         priority: 'medium', reason: 'Dashboarding is listed as a "nice to have" — having it makes you a stronger candidate.' },
  { name: 'JIRA / Confluence',          priority: 'medium', reason: 'Standard PM tooling at this company — shows you can hit the ground running.' },
  { name: 'API Basics (REST)',          priority: 'low',    reason: 'Useful for cross-functional work with engineering; not required but builds credibility.' },
];

const SAMPLE_SOFT_SKILLS = [
  { name: 'Stakeholder Communication', priority: 'high',   reason: 'The JD emphasizes cross-team alignment — your resume focuses on execution, not influence.' },
  { name: 'Strategic Thinking',        priority: 'high',   reason: 'Role expects roadmap ownership; your resume shows task delivery, not vision-setting.' },
  { name: 'Conflict Resolution',       priority: 'medium', reason: 'Managing competing priorities across teams is a core expectation for this seniority.' },
  { name: 'Executive Storytelling',    priority: 'medium', reason: 'Presenting to leadership is mentioned — structuring data into a narrative is key.' },
  { name: 'Agile / Scrum Fluency',     priority: 'low',    reason: 'Team runs in sprints; understanding the cadence helps collaboration even in a non-dev role.' },
];

function renderSkillList(listEl, countEl, skills) {
  listEl.innerHTML = '';
  countEl.textContent = skills.length;
  skills.forEach((skill, i) => {
    const li = document.createElement('li');
    li.className = 'skill-item';
    li.style.animationDelay = `${i * 60}ms`;
    li.innerHTML = `
      <div class="skill-item-top">
        <span class="skill-name">${skill.name}</span>
        <span class="skill-priority skill-priority--${skill.priority}">${skill.priority}</span>
      </div>
      <p class="skill-reason">${skill.reason}</p>`;
    listEl.appendChild(li);
  });
}

// ── Resume version data (sample — replaced by API response later) ─
const RESUME_VERSIONS = [
  {
    id: 'v1',
    label: 'Version 1',
    recommended: true,
    title: 'Full-Stack Alignment',
    desc: 'Maximally aligned to the JD — every bullet tuned to match the role\'s language and priorities.',
    additionsCount: 6,
    resumeText: `Priya Sharma
priya.sharma@email.com | +91 98765 43210 | linkedin.com/in/priyasharma | Bangalore, India

PROFESSIONAL SUMMARY
%%Results-driven Product Manager with 5+ years of experience driving cross-functional alignment and delivering 0-to-1 products in high-growth SaaS environments.%% Proven track record of owning roadmaps end-to-end and communicating strategy to executive stakeholders.

EXPERIENCE

Senior Product Manager — FinTech Startup, Bangalore (2021–Present)
• %%Led stakeholder alignment across Engineering, Design, and Business teams to ship 3 core product features, increasing DAU by 34%.%%
• %%Defined and owned the product roadmap for Q3–Q4 2023, prioritising features using RICE scoring and quarterly OKRs.%%
• Managed a backlog of 120+ tickets in JIRA and ran bi-weekly sprint reviews with engineering leads.
• %%Presented monthly business reviews to C-suite, synthesising complex data into executive-ready narratives.%%

Product Manager — EdTech Platform, Pune (2019–2021)
• Launched 2 new course formats, driving a 22% increase in course completion rates.
• %%Facilitated cross-team conflict resolution between content and engineering during a platform migration, reducing delays by 3 weeks.%%
• Collaborated with data team to build Tableau dashboards tracking learner engagement metrics.

EDUCATION
B.Tech Computer Science — BITS Pilani (2019)

SKILLS
Product Strategy · Roadmap Ownership · JIRA & Confluence · Tableau · Stakeholder Management · Agile/Scrum · SQL (intermediate)`,
  },
  {
    id: 'v2',
    label: 'Version 2',
    recommended: false,
    title: 'Metrics-Forward',
    desc: 'Leads with numbers and impact — ideal if the role values quantifiable outcomes above all.',
    additionsCount: 4,
    resumeText: `Priya Sharma
priya.sharma@email.com | +91 98765 43210 | linkedin.com/in/priyasharma | Bangalore, India

PROFESSIONAL SUMMARY
Product Manager with 5+ years building data-informed products. %%Consistently delivered measurable outcomes — 34% DAU lift, 22% completion rate improvement, 3-week delay reduction —%% by combining sharp prioritisation with rigorous execution.

EXPERIENCE

Senior Product Manager — FinTech Startup, Bangalore (2021–Present)
• Shipped 3 core product features, increasing DAU by 34% within 2 quarters.
• %%Reduced average feature delivery time by 18% by introducing RICE-based prioritisation and bi-weekly sprint cadence.%%
• Managed 120+ ticket backlog in JIRA across 4 engineering squads.
• %%Built SQL-based reporting pipeline that cut weekly ops reporting time from 6 hours to 45 minutes.%%

Product Manager — EdTech Platform, Pune (2019–2021)
• Launched 2 course formats → 22% improvement in completion rates.
• Reduced platform migration delay by 3 weeks through structured conflict-resolution process.
• Built Tableau dashboards used by 3 teams to track learner KPIs.

EDUCATION
B.Tech Computer Science — BITS Pilani (2019)

SKILLS
SQL & Data Analysis · Product Strategy · JIRA & Confluence · Tableau · Agile/Scrum · Stakeholder Communication`,
  },
  {
    id: 'v3',
    label: 'Version 3',
    recommended: false,
    title: 'Narrative & Leadership',
    desc: 'Emphasises strategic thinking and leadership voice — best for senior or people-manager roles.',
    additionsCount: 3,
    resumeText: `Priya Sharma
priya.sharma@email.com | +91 98765 43210 | linkedin.com/in/priyasharma | Bangalore, India

PROFESSIONAL SUMMARY
%%Strategic product leader who turns ambiguous problems into clear roadmaps and rallies cross-functional teams around a shared vision.%% 5+ years building products at the intersection of user empathy and business impact.

EXPERIENCE

Senior Product Manager — FinTech Startup, Bangalore (2021–Present)
• %%Defined a 12-month product vision for the core payments flow, aligning 3 squads around a single north-star metric (DAU), resulting in 34% growth.%%
• Championed a quarterly OKR process adopted company-wide, improving roadmap transparency for all stakeholders.
• Presented strategic reviews to CEO and board — distilling product performance into clear, actionable narratives.

Product Manager — EdTech Platform, Pune (2019–2021)
• %%Spearheaded a platform migration affecting 200K+ users, navigating competing priorities across 4 teams with zero customer-facing downtime.%%
• Grew learner engagement by 22% by repositioning two underperforming course formats.

EDUCATION
B.Tech Computer Science — BITS Pilani (2019)

SKILLS
Product Vision & Strategy · Executive Communication · Cross-functional Leadership · Roadmap Ownership · Agile · JIRA · Tableau`,
  },
];

// ── Output screen helpers ──────────────────────────────────────
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseHighlights(text) {
  // Convert %%text%% into <span class="rv-highlight">text</span>
  return escapeHTML(text).replace(/%%(.+?)%%/g, (_, inner) =>
    `<span class="rv-highlight">${inner}</span>`
  );
}

// ── Tab switching ──────────────────────────────────────────────
function switchResumeTab(versionId) {
  document.querySelectorAll('.rv-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.rv-tab').forEach(t => t.classList.remove('rv-tab--active'));
  document.getElementById(`rv-panel-${versionId}`).style.display = '';
  document.getElementById(`rv-tab-${versionId}`).classList.add('rv-tab--active');
}

function buildVersionPanel(v, visible) {
  const recTag = v.recommended
    ? `<span class="rv-meta-rec">&#10024; Recommended</span>`
    : '';
  return `
    <div class="rv-panel" id="rv-panel-${v.id}" style="${visible ? '' : 'display:none'}">
      <div class="rv-meta">
        ${recTag}
        <span class="rv-meta-title">${v.title}</span>
        <span class="rv-meta-dot">·</span>
        <span class="rv-meta-desc">${v.desc}</span>
        <span class="rv-meta-badge">+${v.additionsCount} additions</span>
      </div>
      <div class="rv-document">${parseHighlights(v.resumeText)}</div>
      <div class="rv-actions">
        <button class="btn-rv-copy" onclick="copyResume('${v.id}')">Copy text</button>
        <div class="rv-download-wrap" id="wrap-${v.id}">
          <button class="btn-rv-download" onclick="toggleDownload('${v.id}', event)">
            Download &#9660;
          </button>
          <div class="rv-dropdown" id="drop-${v.id}">
            <button class="rv-dropdown-opt" onclick="downloadResume('${v.id}', 'pdf')">&#128196; Download as PDF</button>
            <button class="rv-dropdown-opt" onclick="downloadResume('${v.id}', 'docx')">&#128209; Download as Word (.docx)</button>
          </div>
        </div>
      </div>
    </div>`;
}

function buildOutputHTML() {
  const tabs = RESUME_VERSIONS.map(v => {
    const star = v.recommended ? ' &#10024;' : '';
    return `<button class="rv-tab" id="rv-tab-${v.id}" onclick="switchResumeTab('${v.id}')">${v.label}${star}</button>`;
  }).join('');

  const panels = RESUME_VERSIONS.map((v, i) => buildVersionPanel(v, i === 0)).join('');

  return `
    <div class="rv-section-label">&#10024; GapLift complete &mdash; review your 3 tailored versions</div>
    <div class="rv-tabs-bar">${tabs}</div>
    <div class="rv-panels">${panels}</div>
    <div class="rv-continue-bar">
      <p class="rv-continue-hint">Done reviewing? See exactly which skills to close next.</p>
      <button class="btn-continue-gaplift" onclick="proceedToGapLift()">Continue to Get GapLift &#8594;</button>
    </div>`;
}

// ── Proceed from step 3 → step 4 ──────────────────────────────
function proceedToGapLift() {
  const magicSection = document.getElementById('magicSection');
  magicSection.style.display = '';
  renderSkillList(
    document.getElementById('techSkillList'),
    document.getElementById('techCount'),
    SAMPLE_TECH_SKILLS
  );
  renderSkillList(
    document.getElementById('softSkillList'),
    document.getElementById('softCount'),
    SAMPLE_SOFT_SKILLS
  );

  // Mark step 3 done, activate step 4
  const s3 = document.getElementById('step-3');
  s3.classList.remove('step--active');
  s3.classList.add('step--done');
  document.getElementById('conn-3').classList.add('conn--done');
  setStep(4);

  setTimeout(() => {
    magicSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);

  // Show feedback section after a short delay
  setTimeout(() => {
    const fb = document.getElementById('feedbackSection');
    if (fb) fb.style.display = '';
  }, 1200);

  setTimeout(() => {
    document.getElementById('step-4').classList.replace('step--active', 'step--done');
  }, 800);
}

// ── Copy to clipboard ─────────────────────────────────────────
function copyResume(versionId) {
  const v = RESUME_VERSIONS.find(v => v.id === versionId);
  if (!v) return;
  // Strip %% markers for plain text copy
  const plain = v.resumeText.replace(/%%(.+?)%%/g, '$1');
  navigator.clipboard.writeText(plain).then(() => {
    showToast('Copied to clipboard ✓');
  }).catch(() => {
    showToast('Copy failed — please try again');
  });
}

// ── Download dropdown toggle ───────────────────────────────────
function toggleDownload(versionId, e) {
  e.stopPropagation();
  const drop = document.getElementById(`drop-${versionId}`);
  const isOpen = drop.classList.contains('open');
  // Close all dropdowns
  document.querySelectorAll('.rv-dropdown').forEach(d => d.classList.remove('open'));
  if (!isOpen) drop.classList.add('open');
}

document.addEventListener('click', () => {
  document.querySelectorAll('.rv-dropdown').forEach(d => d.classList.remove('open'));
});

// ── Download dispatcher ────────────────────────────────────────
function downloadResume(versionId, format) {
  document.getElementById(`drop-${versionId}`).classList.remove('open');
  const v = RESUME_VERSIONS.find(v => v.id === versionId);
  if (!v) return;
  if (format === 'pdf') {
    downloadPDF(v);
  } else {
    downloadDOCX(v);
  }
}

// ── PDF download ───────────────────────────────────────────────
function downloadPDF(v) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const marginLeft  = 72;  // 1 inch
  const marginRight = 72;
  const marginTop   = 72;
  const pageWidth   = doc.internal.pageSize.getWidth();
  const pageHeight  = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - marginLeft - marginRight;

  let y = marginTop;
  const lineHeight = 16;
  const paraGap = 8;

  function checkPage() {
    if (y > pageHeight - 80) {
      doc.addPage();
      y = marginTop;
    }
  }

  // Parse lines, preserving %%highlight%% markers
  const lines = v.resumeText.split('\n');

  lines.forEach(rawLine => {
    checkPage();
    const trimmed = rawLine.trimEnd();

    if (trimmed === '') {
      y += paraGap;
      return;
    }

    // Split line into segments: normal / highlighted
    const segments = [];
    let cursor = 0;
    const re = /%%(.+?)%%/g;
    let m;
    while ((m = re.exec(trimmed)) !== null) {
      if (m.index > cursor) segments.push({ text: trimmed.slice(cursor, m.index), bold: false });
      segments.push({ text: m[1], bold: true });
      cursor = m.index + m[0].length;
    }
    if (cursor < trimmed.length) segments.push({ text: trimmed.slice(cursor), bold: false });

    // Word-wrap each segment across lines
    // Build array of {text, bold} tokens for the full line
    // Simple approach: render mixed line via text fragments
    let x = marginLeft;
    const wrappedLines = [];

    segments.forEach(seg => {
      doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
      doc.setFontSize(10);
      const words = seg.text.split(' ');
      words.forEach((word, wi) => {
        const token = wi === 0 ? word : ' ' + word;
        const tokenW = doc.getTextWidth(token);
        if (x + tokenW > pageWidth - marginRight && x > marginLeft) {
          wrappedLines.push({ flush: true });
          x = marginLeft;
        }
        wrappedLines.push({ text: token, bold: seg.bold, x });
        x += tokenW;
      });
    });
    wrappedLines.push({ flush: true }); // end of line

    // Render tokens
    let px = marginLeft;
    let py = y;
    wrappedLines.forEach(tok => {
      if (tok.flush) {
        py += lineHeight;
        px = marginLeft;
        y = py;
        return;
      }
      doc.setFont('helvetica', tok.bold ? 'bold' : 'normal');
      doc.setFontSize(10);
      doc.setTextColor(30, 42, 53);
      doc.text(tok.text, tok.x, py - lineHeight + 12);
    });

    checkPage();
  });

  // Branding footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 140, 160);
  doc.text('Generated by GapLift · gaplift.in', marginLeft, pageHeight - 30);

  const fileName = `GapLift_Resume_${v.label.replace(/\s/g, '_')}.pdf`;
  doc.save(fileName);
  showToast('Resume downloaded! ✓');
}

// ── DOCX download ──────────────────────────────────────────────
async function downloadDOCX(v) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = window.docx;

  const paragraphs = [];

  v.resumeText.split('\n').forEach(rawLine => {
    const trimmed = rawLine.trimEnd();
    if (trimmed === '') {
      paragraphs.push(new Paragraph({ text: '' }));
      return;
    }

    // Build TextRun array with yellow highlight for %%...%%
    const runs = [];
    let cursor = 0;
    const re = /%%(.+?)%%/g;
    let m;
    while ((m = re.exec(trimmed)) !== null) {
      if (m.index > cursor) {
        runs.push(new TextRun({ text: trimmed.slice(cursor, m.index), size: 20 }));
      }
      runs.push(new TextRun({
        text: m[1],
        bold: true,
        highlight: 'yellow',
        size: 20,
      }));
      cursor = m.index + m[0].length;
    }
    if (cursor < trimmed.length) {
      runs.push(new TextRun({ text: trimmed.slice(cursor), size: 20 }));
    }

    paragraphs.push(new Paragraph({ children: runs }));
  });

  // Branding footer
  paragraphs.push(new Paragraph({ text: '' }));
  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: 'Generated by GapLift · gaplift.in', size: 16, color: '7a8899' })],
  }));

  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GapLift_Resume_${v.label.replace(/\s/g, '_')}.docx`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Resume downloaded! ✓');
}

// ── Toast notification ─────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  let toast = document.getElementById('gaplift-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'gaplift-toast';
    toast.className = 'gaplift-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ── Feedback: star rating ──────────────────────────────────────
let selectedStars = 0;

document.addEventListener('click', (e) => {
  if (!e.target.classList.contains('star')) return;
  selectedStars = parseInt(e.target.dataset.val);
  document.querySelectorAll('#starRating .star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.val) <= selectedStars);
  });
});

document.addEventListener('mouseover', (e) => {
  if (!e.target.classList.contains('star')) return;
  const hov = parseInt(e.target.dataset.val);
  document.querySelectorAll('#starRating .star').forEach(s => {
    s.style.color = parseInt(s.dataset.val) <= hov ? '#ffd166' : '';
  });
});

document.addEventListener('mouseout', (e) => {
  if (!e.target.classList.contains('star')) return;
  document.querySelectorAll('#starRating .star').forEach(s => {
    s.style.color = parseInt(s.dataset.val) <= selectedStars ? '#ffd166' : '';
  });
});

function submitFeedback() {
  const rating = selectedStars;
  const message = document.getElementById('feedbackText').value.trim();

  if (!rating) { showToast('Please select a star rating first'); return; }

  // Log for now — replace with API/email endpoint when ready
  console.log('GapLift Feedback —', { rating, message });

  document.querySelector('.btn-feedback-submit').style.display = 'none';
  document.querySelector('.star-rating').style.pointerEvents = 'none';
  document.getElementById('feedbackThankyou').style.display = 'block';
  showToast('Feedback sent! Thank you ✓');

  // Scroll to marketing section below
  setTimeout(() => {
    const ms = document.querySelector('.marketing-section');
    if (ms) ms.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 600);
}

function simulatePlaceholderResponse() {
  setTimeout(() => {
    setLoadingState(false);

    // Activate step 3
    setStep(3);

    // Resume output — 3 tabbed versions
    outputArea.classList.add('active');
    outputArea.innerHTML = buildOutputHTML();

    // Activate first tab
    switchResumeTab(RESUME_VERSIONS[0].id);

    outputArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 2000);
}
