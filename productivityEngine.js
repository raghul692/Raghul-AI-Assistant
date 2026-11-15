import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { recordAuditLog, RISK_LEVELS } from './governanceAudit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'data', 'nexus.db');

const db = new Database(DB_FILE);

// Initialize Productivity Tables in SQLite
db.exec(`
  CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    folder TEXT NOT NULL DEFAULT 'inbox',
    sender TEXT NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    location TEXT,
    description TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    due_time INTEGER NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(folder);
  CREATE INDEX IF NOT EXISTS idx_calendar_time ON calendar_events(start_time);
  CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
`);

/**
 * Export Calendar Event as RFC 5545 iCalendar (.ics) format
 */
export function exportCalendarToICS(eventId) {
  const event = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(eventId);
  if (!event) throw new Error(`Event ${eventId} not found`);

  const formatICSDate = (ts) => {
    return new Date(ts).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Raghul AI Frontier Assistant//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@raghul.ai`,
    `DTSTAMP:${formatICSDate(Date.now())}`,
    `DTSTART:${formatICSDate(event.start_time)}`,
    `DTEND:${formatICSDate(event.end_time)}`,
    `SUMMARY:${event.title.replace(/\n/g, ' ')}`,
    `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
    `LOCATION:${event.location || 'Remote'}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return { eventId, ics, filename: `${event.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.ics` };
}

/**
 * Export Email as RFC 822 MIME format (.eml)
 */
export function exportEmailToEML(emailId) {
  const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId);
  if (!email) throw new Error(`Email ${emailId} not found`);

  const eml = [
    `From: ${email.sender}`,
    `To: ${email.recipient}`,
    `Date: ${new Date(email.timestamp).toUTCString()}`,
    `Subject: ${email.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    `Message-ID: <${email.id}@raghul.ai>`,
    '',
    email.body
  ].join('\r\n');

  return { emailId, eml, filename: `${email.subject.toLowerCase().replace(/[^a-z0-9]/g, '_')}.eml` };
}

/**
 * Local Git Repository Integration
 */
import { execSync } from 'child_process';

export function getLocalGitRepositoryInfo() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', timeout: 3000 }).trim();
    const commit = execSync('git log -1 --pretty=format:"%h - %s (%cr)"', { encoding: 'utf8', timeout: 3000 }).trim();
    const status = execSync('git status --short', { encoding: 'utf8', timeout: 3000 }).trim();
    return {
      isGitRepo: true,
      currentBranch: branch,
      latestCommit: commit,
      uncommittedChanges: status ? status.split('\n').length : 0,
      statusSnippet: status.slice(0, 300)
    };
  } catch (err) {
    return {
      isGitRepo: false,
      notice: 'Current directory is not a standalone git repository root or git command timed out.'
    };
  }
}
export function draftEmail({ to, subject, body, sender = 'raghul.engineer@raghul.ai' }) {
  const id = `email_draft_${Date.now()}`;
  db.prepare(`
    INSERT INTO emails (id, folder, sender, recipient, subject, body, timestamp, is_read)
    VALUES (?, 'drafts', ?, ?, ?, ?, ?, 1)
  `).run(id, sender, to, subject, body, Date.now());

  recordAuditLog({
    action: 'DRAFT_EMAIL',
    target: to,
    riskLevel: RISK_LEVELS.WRITE,
    justification: `Created draft email: "${subject}"`
  });

  return { id, folder: 'drafts', to, subject, body };
}

export function sendEmail({ to, subject, body, sender = 'raghul.engineer@raghul.ai' }) {
  const id = `email_${Date.now()}`;
  db.prepare(`
    INSERT INTO emails (id, folder, sender, recipient, subject, body, timestamp, is_read)
    VALUES (?, 'sent', ?, ?, ?, ?, ?, 1)
  `).run(id, sender, to, subject, body, Date.now());

  recordAuditLog({
    action: 'SEND_EMAIL',
    target: to,
    riskLevel: RISK_LEVELS.WRITE,
    justification: `Sent email: "${subject}"`
  });

  return { success: true, id, folder: 'sent', to, subject, timestamp: Date.now() };
}

export function listEmails(folder = 'inbox', limit = 20) {
  return db.prepare('SELECT * FROM emails WHERE folder = ? ORDER BY timestamp DESC LIMIT ?').all(folder, limit);
}

/**
 * 2. CALENDAR & REMINDERS MANAGEMENT
 */
export function createCalendarEvent({ title, startTime, endTime, location = '', description = '' }) {
  const id = `event_${Date.now()}`;
  const start = typeof startTime === 'number' ? startTime : new Date(startTime).getTime();
  const end = typeof endTime === 'number' ? endTime : new Date(endTime).getTime();

  db.prepare(`
    INSERT INTO calendar_events (id, title, start_time, end_time, location, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, start, end, location, description, Date.now());

  recordAuditLog({
    action: 'CREATE_CALENDAR_EVENT',
    target: title,
    riskLevel: RISK_LEVELS.WRITE,
    justification: `Scheduled event from ${new Date(start).toISOString()} to ${new Date(end).toISOString()}`
  });

  return { id, title, startTime: start, endTime: end, location, description };
}

export function listCalendarEvents(fromTime = 0, toTime = Date.now() + 30 * 24 * 3600 * 1000) {
  return db.prepare('SELECT * FROM calendar_events WHERE start_time >= ? AND start_time <= ? ORDER BY start_time ASC').all(fromTime, toTime);
}

export function createReminder({ title, dueTime, priority = 'medium' }) {
  const id = `rem_${Date.now()}`;
  const due = typeof dueTime === 'number' ? dueTime : new Date(dueTime).getTime();

  db.prepare(`
    INSERT INTO reminders (id, title, due_time, priority, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(id, title, due, priority, Date.now());

  recordAuditLog({
    action: 'CREATE_REMINDER',
    target: title,
    riskLevel: RISK_LEVELS.WRITE,
    justification: `Created reminder due at ${new Date(due).toISOString()}`
  });

  return { id, title, dueTime: due, priority, status: 'pending' };
}

export function listReminders(status = 'pending') {
  return db.prepare('SELECT * FROM reminders WHERE status = ? ORDER BY due_time ASC').all(status);
}

export function completeReminder(id) {
  const info = db.prepare("UPDATE reminders SET status = 'completed' WHERE id = ?").run(id);
  return info.changes > 0;
}

/**
 * 3. SPREADSHEETS & STATISTICAL DATA ANALYSIS
 */
export function createSpreadsheet({ title = 'Dataset', headers = [], rows = [] }) {
  const csvLines = [];
  csvLines.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));
  for (const row of rows) {
    csvLines.push(row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','));
  }
  const csvContent = csvLines.join('\n');

  return {
    title,
    rowCount: rows.length,
    columnCount: headers.length,
    headers,
    csvContent,
    previewTableHtml: `
      <table class="table-dataset" style="width:100%; border-collapse:collapse; font-size:0.85rem;">
        <thead>
          <tr style="background:rgba(255,255,255,0.08); text-align:left;">
            ${headers.map(h => `<th style="padding:6px 10px; border-bottom:1px solid rgba(255,255,255,0.15);">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.slice(0, 10).map(r => `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
              ${r.map(v => `<td style="padding:6px 10px;">${v}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
  };
}

export function analyzeDataset({ numbers = [], label = 'Metric' }) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    throw new Error('Valid array of numbers required for statistical analysis');
  }

  const valid = numbers.map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
  const count = valid.length;
  if (count === 0) throw new Error('No valid numeric values in dataset');

  const sum = valid.reduce((acc, val) => acc + val, 0);
  const mean = sum / count;
  const min = valid[0];
  const max = valid[count - 1];

  let median;
  const mid = Math.floor(count / 2);
  if (count % 2 === 0) {
    median = (valid[mid - 1] + valid[mid]) / 2;
  } else {
    median = valid[mid];
  }

  const variance = valid.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  return {
    label,
    count,
    sum: Math.round(sum * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    min,
    max,
    range: max - min,
    variance: Math.round(variance * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100
  };
}

/**
 * 4. DATA VISUALIZATION (Chart.js & SVG Chart Generator)
 */
export function generateChart({ type = 'bar', title = 'Chart', labels = [], data = [], datasetLabel = 'Values' }) {
  const chartConfig = {
    type,
    data: {
      labels,
      datasets: [{
        label: datasetLabel,
        data,
        backgroundColor: [
          'rgba(99, 102, 241, 0.65)',
          'rgba(14, 165, 233, 0.65)',
          'rgba(16, 185, 129, 0.65)',
          'rgba(245, 158, 11, 0.65)',
          'rgba(239, 68, 68, 0.65)',
          'rgba(168, 85, 247, 0.65)'
        ],
        borderColor: [
          '#6366f1',
          '#0ea5e9',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#a855f7'
        ],
        borderWidth: 1.5
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: title, color: '#f8fafc', font: { size: 14 } },
        legend: { labels: { color: '#94a3b8' } }
      }
    }
  };

  // Embeddable HTML Sandbox with Chart.js
  const htmlSandbox = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { margin: 0; background: #0f172a; padding: 24px; font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 85vh; }
    .chart-box { background: #1e293b; border-radius: 12px; padding: 20px; width: 100%; max-width: 650px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
  </style>
</head>
<body>
  <div class="chart-box">
    <canvas id="canvasChart"></canvas>
  </div>
  <script>
    const ctx = document.getElementById('canvasChart').getContext('2d');
    new Chart(ctx, ${JSON.stringify(chartConfig)});
  </script>
</body>
</html>`;

  return {
    type,
    title,
    chartConfig,
    htmlSandbox
  };
}

/**
 * 5. PRESENTATION SLIDE DECK GENERATOR
 */
export function generatePresentationDeck({ title = 'Raghul AI Presentation', slides = [] }) {
  const slidesHtml = slides.map((s, idx) => `
    <div class="slide" id="slide-${idx + 1}" style="${idx === 0 ? 'display:block;' : 'display:none;'}">
      <div class="slide-badge">SLIDE ${idx + 1} OF ${slides.length}</div>
      <h2 class="slide-title">${s.title}</h2>
      <ul class="slide-bullets">
        ${(s.bullets || []).map(b => `<li>${b}</li>`).join('')}
      </ul>
      ${s.speakerNotes ? `<div class="speaker-notes">💡 Note: ${s.speakerNotes}</div>` : ''}
    </div>
  `).join('\n');

  const fullDeckHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; background: #090d16; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box; }
    .deck-frame { width: 100%; max-width: 820px; background: #0f172a; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 40px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); position: relative; min-height: 380px; display: flex; flex-direction: column; justify-content: space-between; }
    .slide-badge { font-size: 0.75rem; text-transform: uppercase; color: #6366f1; letter-spacing: 1.5px; font-weight: 700; margin-bottom: 8px; }
    .slide-title { font-size: 1.8rem; margin: 0 0 24px 0; color: #ffffff; border-bottom: 2px solid rgba(99,102,241,0.3); padding-bottom: 12px; }
    .slide-bullets { font-size: 1.1rem; line-height: 1.8; color: #cbd5e1; padding-left: 24px; }
    .slide-bullets li { margin-bottom: 10px; }
    .speaker-notes { margin-top: 20px; padding: 10px 14px; background: rgba(99,102,241,0.12); border-left: 3px solid #6366f1; border-radius: 6px; font-size: 0.85rem; color: #c7d2fe; }
    .deck-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 30px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); }
    .deck-btn { background: #6366f1; color: #ffffff; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: background 0.15s ease; }
    .deck-btn:hover { background: #4f46e5; }
    .deck-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .deck-counter { font-size: 0.85rem; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="deck-frame">
    <div id="slidesContainer">
      ${slidesHtml}
    </div>
    <div class="deck-nav">
      <button class="deck-btn" id="prevBtn" onclick="prevSlide()" disabled>← Previous</button>
      <span class="deck-counter" id="slideIndicator">1 / ${slides.length}</span>
      <button class="deck-btn" id="nextBtn" onclick="nextSlide()">Next →</button>
    </div>
  </div>
  <script>
    let currentSlide = 0;
    const total = ${slides.length};
    function showSlide(idx) {
      for (let i = 0; i < total; i++) {
        const el = document.getElementById('slide-' + (i + 1));
        if (el) el.style.display = (i === idx) ? 'block' : 'none';
      }
      document.getElementById('slideIndicator').innerText = (idx + 1) + ' / ' + total;
      document.getElementById('prevBtn').disabled = (idx === 0);
      document.getElementById('nextBtn').disabled = (idx === total - 1);
    }
    function nextSlide() { if (currentSlide < total - 1) { currentSlide++; showSlide(currentSlide); } }
    function prevSlide() { if (currentSlide > 0) { currentSlide--; showSlide(currentSlide); } }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    });
  </script>
</body>
</html>`;

  return {
    title,
    slideCount: slides.length,
    fullDeckHtml
  };
}

/**
 * 6. FORMATTED DOCUMENT / REPORT CREATOR
 */
export function generatePublicationDocument({ title, author = 'Raghul (Full-Stack Engineer)', abstract = '', sections = [] }) {
  const sectionsHtml = sections.map((sec, idx) => `
    <section class="doc-section" style="margin-bottom: 24px;">
      <h2 style="font-size: 1.3rem; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">${idx + 1}. ${sec.title}</h2>
      <div style="font-size: 0.95rem; line-height: 1.7; color: #334155; margin-top: 10px;">
        ${sec.content}
      </div>
    </section>
  `).join('\n');

  const fullDocHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @media print {
      body { background: #fff; padding: 0; }
      .no-print { display: none; }
    }
    body { margin: 0; background: #f1f5f9; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Georgia, serif; color: #0f172a; }
    .doc-page { max-width: 800px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .doc-header { border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
    .doc-title { font-size: 2rem; margin: 0 0 8px 0; color: #0f172a; }
    .doc-meta { font-size: 0.85rem; color: #64748b; }
    .doc-abstract { background: #f8fafc; border-left: 4px solid #6366f1; padding: 14px 18px; margin-bottom: 28px; font-style: italic; color: #475569; }
  </style>
</head>
<body>
  <div class="doc-page">
    <header class="doc-header">
      <h1 class="doc-title">${title}</h1>
      <div class="doc-meta">Prepared by <strong>${author}</strong> • Date: ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })} • RAGHUL AI Verified Document</div>
    </header>
    ${abstract ? `<div class="doc-abstract"><strong>Abstract:</strong> ${abstract}</div>` : ''}
    ${sectionsHtml}
  </div>
</body>
</html>`;

  return {
    title,
    sectionCount: sections.length,
    fullDocHtml
  };
}

