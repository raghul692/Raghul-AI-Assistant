import express from 'express';
import {
  draftEmail, sendEmail, listEmails,
  createCalendarEvent, listCalendarEvents,
  createReminder, listReminders, completeReminder,
  createSpreadsheet, analyzeDataset, generateChart,
  generatePresentationDeck, generatePublicationDocument,
  exportCalendarToICS, exportEmailToEML
} from '../productivityEngine.js';

const router = express.Router();

// 1. Email Management
router.get('/emails', (req, res) => {
  const folder = req.query.folder || 'inbox';
  res.json({ emails: listEmails(folder) });
});

router.post('/emails/draft', (req, res) => {
  const { to, subject, body } = req.body;
  if (!to || !subject) return res.status(400).json({ error: 'Recipient and subject required' });
  const draft = draftEmail({ to, subject, body: body || '' });
  res.json({ success: true, draft });
});

router.post('/emails/send', (req, res) => {
  const { to, subject, body } = req.body;
  if (!to || !subject) return res.status(400).json({ error: 'Recipient and subject required' });
  const sent = sendEmail({ to, subject, body: body || '' });
  res.json({ success: true, sent });
});

// 2. Calendar Management
router.get('/calendar', (req, res) => {
  res.json({ events: listCalendarEvents() });
});

router.post('/calendar', (req, res) => {
  const { title, startTime, endTime, location, description } = req.body;
  if (!title || !startTime) return res.status(400).json({ error: 'Title and startTime required' });
  const event = createCalendarEvent({ title, startTime, endTime: endTime || (startTime + 3600000), location, description });
  res.json({ success: true, event });
});

// 3. Reminders
router.get('/reminders', (req, res) => {
  const status = req.query.status || 'pending';
  res.json({ reminders: listReminders(status) });
});

router.post('/reminders', (req, res) => {
  const { title, dueTime, priority } = req.body;
  if (!title) return res.status(400).json({ error: 'Reminder title required' });
  const reminder = createReminder({ title, dueTime: dueTime || (Date.now() + 3600000), priority });
  res.json({ success: true, reminder });
});

router.post('/reminders/:id/complete', (req, res) => {
  const completed = completeReminder(req.params.id);
  res.json({ success: completed });
});

// 4. Spreadsheets, Data Analysis & Visualization
router.post('/spreadsheet', (req, res) => {
  const { title, headers, rows } = req.body;
  const sheet = createSpreadsheet({ title, headers: headers || [], rows: rows || [] });
  res.json(sheet);
});

router.post('/analyze', (req, res) => {
  const { numbers, label } = req.body;
  if (!numbers || !Array.isArray(numbers)) return res.status(400).json({ error: 'Array of numbers required' });
  const stats = analyzeDataset({ numbers, label });
  res.json(stats);
});

router.post('/chart', (req, res) => {
  const { type, title, labels, data, datasetLabel } = req.body;
  const chart = generateChart({ type, title, labels, data, datasetLabel });
  res.json(chart);
});

router.post('/presentation', (req, res) => {
  const { title, slides } = req.body;
  const deck = generatePresentationDeck({ title, slides: slides || [] });
  res.json(deck);
});

router.post('/document', (req, res) => {
  const { title, author, abstract, sections } = req.body;
  const doc = generatePublicationDocument({ title, author, abstract, sections: sections || [] });
  res.json(doc);
});

// 5. Exports
router.get('/calendar/export-ics/:id', (req, res) => {
  try {
    const icsContent = exportCalendarToICS(req.params.id);
    if (!icsContent) return res.status(404).json({ error: 'Calendar event not found' });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="event_${req.params.id}.ics"`);
    res.send(icsContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/emails/export-eml/:id', (req, res) => {
  try {
    const emlContent = exportEmailToEML(req.params.id);
    if (!emlContent) return res.status(404).json({ error: 'Email record not found' });
    res.setHeader('Content-Type', 'message/rfc822; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="email_${req.params.id}.eml"`);
    res.send(emlContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

