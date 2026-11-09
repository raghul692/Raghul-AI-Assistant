import { db } from '../../db.js';
import crypto from 'crypto';

export class ResearchRepository {
  // --- Jobs ---
  static createJob({ id, sessionId, query, originalQuery, domain = 'general', mode = 'deep', budgetUsd = 2.0, requireApproval = true }) {
    const jobId = id || `rjob_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const effectiveQuery = query || originalQuery || 'Untitled Research Query';
    const now = Date.now();
    const stmt = db.prepare(`
      INSERT INTO research_jobs (
        id, session_id, user_query, domain, mode, status, require_approval,
        current_stage, progress, budget_usd, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'PLANNING', ?, 'PLANNING', 5, ?, ?, ?)
    `);
    stmt.run(jobId, sessionId || null, effectiveQuery, domain, mode, requireApproval ? 1 : 0, budgetUsd, now, now);
    return this.getJob(jobId);
  }

  static getJob(id) {
    const stmt = db.prepare('SELECT * FROM research_jobs WHERE id = ?');
    const job = stmt.get(id);
    if (!job) return null;
    return {
      ...job,
      require_approval: Boolean(job.require_approval)
    };
  }

  static listJobs(limit = 30) {
    const stmt = db.prepare('SELECT * FROM research_jobs ORDER BY created_at DESC LIMIT ?');
    return stmt.all(limit).map(j => ({ ...j, require_approval: Boolean(j.require_approval) }));
  }

  static updateJobProgress(id, { stage, progress, status, error = null }) {
    const now = Date.now();
    const updates = ['updated_at = ?'];
    const params = [now];

    if (stage !== undefined) { updates.push('current_stage = ?'); params.push(stage); }
    if (progress !== undefined) { updates.push('progress = ?'); params.push(progress); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (error !== undefined) { updates.push('error_message = ?'); params.push(error); }

    params.push(id);
    const sql = `UPDATE research_jobs SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...params);
    return this.getJob(id);
  }

  static updateJobCounts(id, { sourcesCount, claimsCount, spentUsd, tokens }) {
    const now = Date.now();
    const stmt = db.prepare(`
      UPDATE research_jobs 
      SET sources_count = COALESCE(?, sources_count),
          claims_count = COALESCE(?, claims_count),
          spent_usd = spent_usd + COALESCE(?, 0),
          total_tokens = total_tokens + COALESCE(?, 0),
          updated_at = ?
      WHERE id = ?
    `);
    stmt.run(sourcesCount ?? null, claimsCount ?? null, spentUsd || 0, tokens || 0, now, id);
  }

  static completeJob(id, { actualDurationMs, status = 'COMPLETED' } = {}) {
    const now = Date.now();
    db.prepare(`
      UPDATE research_jobs 
      SET status = ?, current_stage = ?, progress = 100, actual_duration_ms = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(status, status, actualDurationMs || null, now, now, id);
    return this.getJob(id);
  }

  // --- Plans ---
  static savePlan({ jobId, title, domain, timeSensitivity, targetEntities, constraints, subtopics, primaryQuestions, searchStrategy, approved = 0 }) {
    const planId = `rplan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const effectiveTitle = title || 'Autonomous Research Investigation Plan';
    const now = Date.now();
    const stmt = db.prepare(`
      INSERT INTO research_plans (
        id, job_id, title, domain, time_sensitivity, target_entities, constraints,
        subtopics, primary_questions, search_strategy, approved, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      planId, jobId, effectiveTitle, domain || 'technology', timeSensitivity || 'current',
      JSON.stringify(targetEntities || []), JSON.stringify(constraints || []),
      JSON.stringify(subtopics || []), JSON.stringify(primaryQuestions || []),
      JSON.stringify(searchStrategy || {}), approved ? 1 : 0, now, now
    );
    return this.getPlanByJobId(jobId);
  }

  static getPlanByJobId(jobId) {
    const stmt = db.prepare('SELECT * FROM research_plans WHERE job_id = ? ORDER BY created_at DESC LIMIT 1');
    const p = stmt.get(jobId);
    if (!p) return null;
    return {
      ...p,
      approved: Boolean(p.approved),
      target_entities: JSON.parse(p.target_entities || '[]'),
      constraints: JSON.parse(p.constraints || '[]'),
      subtopics: JSON.parse(p.subtopics || '[]'),
      primary_questions: JSON.parse(p.primary_questions || '[]'),
      search_strategy: JSON.parse(p.search_strategy || '{}')
    };
  }

  static approvePlan(jobId, userFeedback = null) {
    const now = Date.now();
    db.prepare(`
      UPDATE research_plans SET approved = 1, user_feedback = ?, updated_at = ? WHERE job_id = ?
    `).run(userFeedback, now, jobId);
    db.prepare(`
      UPDATE research_jobs SET status = 'SEARCHING', approved_at = ?, updated_at = ? WHERE id = ?
    `).run(now, now, jobId);
    return this.getPlanByJobId(jobId);
  }

  // --- Queries ---
  static addQuery({ jobId, channel, searchEngine, subtopic, query, purpose = 'discovery', isCounterResearch = false }) {
    const queryId = `rq_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const effectiveChannel = channel || searchEngine || 'unified_search';
    const stmt = db.prepare(`
      INSERT INTO research_queries (
        id, job_id, channel, subtopic, query, purpose, is_counter_research, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `);
    stmt.run(queryId, jobId, effectiveChannel, subtopic || null, query, purpose, isCounterResearch ? 1 : 0, Date.now());
    return queryId;
  }

  static updateQueryStatus(queryId, { status, resultCount, durationMs }) {
    db.prepare(`
      UPDATE research_queries SET status = ?, result_count = ?, duration_ms = ? WHERE id = ?
    `).run(status, resultCount || 0, durationMs || 0, queryId);
  }

  static getQueriesByJobId(jobId) {
    return db.prepare('SELECT * FROM research_queries WHERE job_id = ? ORDER BY created_at ASC').all(jobId);
  }

  // --- Sources ---
  static addSource({ id, jobId, url, canonicalUrl, domain, publisher, title, author, publishedDate, category = 'web', credibilityScore = 0.5, credibilityReasons = [], isPrimarySource = false }) {
    const sourceId = id || `src_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    let effectiveDomain = domain || publisher || 'web';
    try {
      if (url && !domain) effectiveDomain = new URL(url).hostname.replace('www.', '');
    } catch (_) {}

    const stmt = db.prepare(`
      INSERT INTO research_sources (
        id, job_id, url, canonical_url, domain, title, author, published_date,
        category, credibility_score, credibility_reasons, is_primary_source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(job_id, url) DO UPDATE SET
        title = COALESCE(excluded.title, title),
        credibility_score = MAX(credibility_score, excluded.credibility_score)
    `);
    stmt.run(
      sourceId, jobId, url, canonicalUrl || url, effectiveDomain, title || effectiveDomain,
      author || null, publishedDate || null, category, credibilityScore,
      JSON.stringify(credibilityReasons || []), isPrimarySource ? 1 : 0, Date.now()
    );
    return db.prepare('SELECT * FROM research_sources WHERE job_id = ? AND url = ?').get(jobId, url);
  }

  static getSourcesByJobId(jobId) {
    const rows = db.prepare('SELECT * FROM research_sources WHERE job_id = ? ORDER BY credibility_score DESC').all(jobId);
    return rows.map(r => ({
      ...r,
      is_primary_source: Boolean(r.is_primary_source),
      credibility_reasons: JSON.parse(r.credibility_reasons || '[]')
    }));
  }

  // --- Source Fetches ---
  static saveSourceFetch({ sourceId, jobId, contentHash, httpStatus = 200, contentType = 'text/html', rawText, cleanText, extractionMethod }) {
    const fetchId = `sfetch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const wordCount = (cleanText || '').split(/\s+/).filter(Boolean).length;
    db.prepare(`
      INSERT INTO source_fetches (
        id, source_id, job_id, content_hash, http_status, content_type,
        raw_text, clean_text, word_count, extraction_method, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fetchId, sourceId, jobId, contentHash, httpStatus, contentType,
      rawText || null, cleanText || '', wordCount, extractionMethod, Date.now()
    );
    return fetchId;
  }

  static getSourceFetches(jobId) {
    return db.prepare('SELECT * FROM source_fetches WHERE job_id = ?').all(jobId);
  }

  // --- Evidence Items ---
  static addEvidenceItem({ id, jobId, sourceId, snippet, relevanceScore = 0.5, supportsSubtopic = null, isCounterEvidence = false, charCount = null, passageIndex = null, contentHash = null }) {
    const evidenceId = id || `ev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    db.prepare(`
      INSERT INTO evidence_items (
        id, job_id, source_id, snippet, relevance_score, supports_subtopic, is_counter_evidence, char_count, passage_index, content_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      evidenceId, jobId, sourceId, snippet, relevanceScore, supportsSubtopic,
      isCounterEvidence ? 1 : 0, charCount || snippet?.length || 0,
      passageIndex !== null ? passageIndex : 0, contentHash || '', Date.now()
    );
    return evidenceId;
  }

  static saveEvidenceBatch(jobId, evidenceItems = []) {
    if (!evidenceItems.length) return [];
    const insert = db.prepare(`
      INSERT INTO evidence_items (
        id, job_id, source_id, snippet, relevance_score, supports_subtopic, is_counter_evidence, char_count, passage_index, content_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const ids = [];
    db.transaction(() => {
      for (const ev of evidenceItems) {
        const id = ev.id || `ev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        insert.run(
          id, jobId, ev.sourceId, ev.snippet, ev.relevanceScore || 0.7,
          ev.supportsSubtopic || null, ev.isCounterEvidence ? 1 : 0,
          ev.charCount || ev.snippet?.length || 0, ev.passageIndex || 0,
          ev.contentHash || '', Date.now()
        );
        ids.push(id);
      }
    })();
    return ids;
  }

  static getEvidenceByJobId(jobId) {
    return db.prepare(`
      SELECT e.*, s.title as source_title, s.url as source_url, s.domain, s.credibility_score
      FROM evidence_items e
      JOIN research_sources s ON e.source_id = s.id
      WHERE e.job_id = ?
      ORDER BY e.relevance_score DESC
    `).all(jobId).map(e => ({ ...e, is_counter_evidence: Boolean(e.is_counter_evidence) }));
  }

  // --- Claims ---
  static addClaim({
    id,
    jobId,
    statement,
    category = 'fact',
    verificationStatus = 'UNVERIFIED',
    confidenceScore = 0.5,
    verificationNotes = null,
    isCritical = false,
    exactQuote = null,
    primarySourceId = null,
    verifiedAt = null
  }) {
    const claimId = id || `clm_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    db.prepare(`
      INSERT INTO research_claims (
        id, job_id, statement, category, verification_status, confidence_score, verification_notes, is_critical, exact_quote, primary_source_id, verified_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      claimId, jobId, statement, category, verificationStatus, confidenceScore,
      verificationNotes, isCritical ? 1 : 0, exactQuote || null, primarySourceId || null,
      verifiedAt || null, Date.now()
    );
    return claimId;
  }

  static saveClaimsBatch(jobId, claims = []) {
    if (!claims.length) return [];
    const insert = db.prepare(`
      INSERT INTO research_claims (
        id, job_id, statement, category, verification_status, confidence_score, verification_notes, is_critical, exact_quote, primary_source_id, verified_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const ids = [];
    db.transaction(() => {
      for (const c of claims) {
        const id = c.id || `clm_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        insert.run(
          id, jobId, c.statement || c.claimText, c.category || c.claimType || 'fact',
          c.verificationStatus || 'UNVERIFIED', c.confidenceScore || 0.5,
          c.verificationNotes || null, c.isCritical ? 1 : 0,
          c.exactQuote || null, c.primarySourceId || null, c.verifiedAt || null, Date.now()
        );
        ids.push(id);
      }
    })();
    return ids;
  }

  static updateClaimVerification(claimId, { verificationStatus, confidenceScore, verificationNotes, verifiedAt = Date.now() }) {
    db.prepare(`
      UPDATE research_claims
      SET verification_status = ?,
          confidence_score = COALESCE(?, confidence_score),
          verification_notes = COALESCE(?, verification_notes),
          verified_at = ?
      WHERE id = ?
    `).run(verificationStatus, confidenceScore, verificationNotes, verifiedAt, claimId);
  }

  static linkClaimEvidence(claimId, evidenceId, relationship = 'supports') {
    db.prepare(`
      INSERT OR REPLACE INTO claim_evidence (claim_id, evidence_id, relationship)
      VALUES (?, ?, ?)
    `).run(claimId, evidenceId, relationship);
  }

  static linkClaimEvidenceBatch(links = []) {
    if (!links.length) return;
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO claim_evidence (claim_id, evidence_id, relationship)
      VALUES (?, ?, ?)
    `);
    db.transaction(() => {
      for (const l of links) {
        stmt.run(l.claimId, l.evidenceId, l.relationship || 'supports');
      }
    })();
  }

  static getClaimsByJobId(jobId) {
    const claims = db.prepare('SELECT * FROM research_claims WHERE job_id = ? ORDER BY is_critical DESC, confidence_score DESC').all(jobId);
    return claims.map(c => {
      const linkedEvidence = db.prepare(`
        SELECT e.*, ce.relationship, s.title as source_title, s.url as source_url
        FROM claim_evidence ce
        JOIN evidence_items e ON ce.evidence_id = e.id
        JOIN research_sources s ON e.source_id = s.id
        WHERE ce.claim_id = ?
      `).all(c.id);
      return {
        ...c,
        claimText: c.statement,
        claimType: c.category,
        is_critical: Boolean(c.is_critical),
        evidence: linkedEvidence
      };
    });
  }

  // --- Contradictions ---
  static addContradiction({ id, jobId, claimId = null, sourceAId, sourceBId, disputedTopic, sourceAAssertion, sourceBAssertion, resolutionStrategy = 'disputed_in_report', finalDisposition = '' }) {
    const cntId = id || `cnt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    db.prepare(`
      INSERT INTO research_contradictions (
        id, job_id, claim_id, source_a_id, source_b_id, disputed_topic, source_a_assertion, source_b_assertion, resolution_strategy, final_disposition, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cntId, jobId, claimId, sourceAId, sourceBId, disputedTopic,
      sourceAAssertion, sourceBAssertion, resolutionStrategy, finalDisposition, Date.now()
    );
    return cntId;
  }

  static getContradictionsByJobId(jobId) {
    return db.prepare('SELECT * FROM research_contradictions WHERE job_id = ? ORDER BY created_at ASC').all(jobId);
  }

  // --- Verification Summary ---
  static getVerificationSummary(jobId) {
    const claims = db.prepare('SELECT * FROM research_claims WHERE job_id = ?').all(jobId);
    const totalClaims = claims.length;
    const verifiedClaims = claims.filter(c => c.verification_status === 'SUPPORTED' || c.verification_status === 'VERIFIED').length;
    const partiallySupported = claims.filter(c => c.verification_status === 'PARTIALLY_SUPPORTED').length;
    const contradictedClaims = claims.filter(c => c.verification_status === 'CONTRADICTED' || c.verification_status === 'DISPUTED').length;
    const unverifiedClaims = claims.filter(c => c.verification_status === 'UNVERIFIED').length;

    const contradictions = db.prepare('SELECT COUNT(*) as cnt FROM research_contradictions WHERE job_id = ?').get(jobId)?.cnt || 0;
    const evidenceCount = db.prepare('SELECT COUNT(*) as cnt FROM evidence_items WHERE job_id = ?').get(jobId)?.cnt || 0;

    return {
      totalClaims,
      verifiedClaims,
      partiallySupported,
      contradictedClaims,
      unverifiedClaims,
      contradictions,
      evidenceCount,
      verificationRate: totalClaims > 0 ? Number(((verifiedClaims + 0.5 * partiallySupported) / totalClaims).toFixed(2)) : 0
    };
  }

  // --- Sections ---
  static saveSections(jobId, sections = []) {
    const insert = db.prepare(`
      INSERT INTO research_sections (id, job_id, section_index, title, section_type, content_markdown, tables_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      db.prepare('DELETE FROM research_sections WHERE job_id = ?').run(jobId);
      sections.forEach((sec, idx) => {
        const secId = `rsec_${Date.now()}_${idx}_${crypto.randomBytes(3).toString('hex')}`;
        insert.run(
          secId, jobId, idx, sec.title, sec.sectionType || 'chapter',
          sec.contentMarkdown || '', JSON.stringify(sec.tables || []), Date.now()
        );
      });
    })();
  }

  static getSectionsByJobId(jobId) {
    const rows = db.prepare('SELECT * FROM research_sections WHERE job_id = ? ORDER BY section_index ASC').all(jobId);
    return rows.map(r => ({ ...r, tables: JSON.parse(r.tables_json || '[]') }));
  }

  // --- Citations ---
  static saveCitations(jobId, citations = []) {
    const insert = db.prepare(`
      INSERT INTO research_citations (id, job_id, citation_number, source_id, claim_id, formatted_text, url, doi, verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      db.prepare('DELETE FROM research_citations WHERE job_id = ?').run(jobId);
      citations.forEach((c, idx) => {
        const citId = `rcit_${Date.now()}_${idx}_${crypto.randomBytes(3).toString('hex')}`;
        insert.run(
          citId, jobId, c.number || idx + 1, c.sourceId, c.claimId || null,
          c.formattedText || '', c.url || null, c.doi || null, c.verified ? 1 : 0
        );
      });
    })();
  }

  static getCitationsByJobId(jobId) {
    return db.prepare('SELECT * FROM research_citations WHERE job_id = ? ORDER BY citation_number ASC').all(jobId);
  }

  // --- Artifacts ---
  static saveArtifact({ jobId, artifactType = 'pdf', filename, filePath, fileSize, contentHash, pageCount = null, validationPassed = 0, validationReport = null }) {
    const artId = `art_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    db.prepare(`
      INSERT INTO research_artifacts (
        id, job_id, artifact_type, filename, file_path, file_size, content_hash,
        page_count, validation_passed, validation_report, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      artId, jobId, artifactType, filename, filePath, fileSize, contentHash,
      pageCount, validationPassed ? 1 : 0, JSON.stringify(validationReport || {}), Date.now()
    );
    return artId;
  }

  static getArtifactsByJobId(jobId) {
    const rows = db.prepare('SELECT * FROM research_artifacts WHERE job_id = ? ORDER BY created_at DESC').all(jobId);
    return rows.map(r => ({
      ...r,
      validation_passed: Boolean(r.validation_passed),
      validation_report: JSON.parse(r.validation_report || '{}')
    }));
  }

  // --- Quality Checks ---
  static saveQualityCheck({ jobId, overallScore, passed, metrics, blockingFailures = [] }) {
    const qId = `qchk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    db.prepare(`
      INSERT INTO research_quality_checks (
        id, job_id, overall_score, passed, metrics_json, blocking_failures, audited_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      qId, jobId, overallScore, passed ? 1 : 0,
      JSON.stringify(metrics || {}), JSON.stringify(blockingFailures || []), Date.now()
    );
    return qId;
  }

  static getQualityCheckByJobId(jobId) {
    const q = db.prepare('SELECT * FROM research_quality_checks WHERE job_id = ? ORDER BY audited_at DESC LIMIT 1').get(jobId);
    if (!q) return null;
    return {
      ...q,
      passed: Boolean(q.passed),
      metrics: JSON.parse(q.metrics_json || '{}'),
      blocking_failures: JSON.parse(q.blocking_failures || '[]')
    };
  }

  // --- Runs & Token Accounting ---
  static recordRun({ jobId, agentRole, provider, model, stepName, promptTokens = 0, completionTokens = 0, costUsd = 0.0, durationMs = 0, status = 'COMPLETED' }) {
    const runId = `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    db.prepare(`
      INSERT INTO research_runs (
        id, job_id, agent_role, provider, model, stepName, prompt_tokens,
        completion_tokens, cost_usd, duration_ms, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId, jobId, agentRole, provider, model, stepName, promptTokens,
      completionTokens, costUsd, durationMs, status, Date.now()
    );
    this.updateJobCounts(jobId, { spentUsd: costUsd, tokens: promptTokens + completionTokens });
    return runId;
  }
}

// Convenient alias object and export
export const researchRepository = {
  createJob: (args) => ResearchRepository.createJob(args),
  getJob: (id) => ResearchRepository.getJob(id),
  listJobs: (limit) => ResearchRepository.listJobs(limit),
  updateJobProgress: (id, args) => ResearchRepository.updateJobProgress(id, args),
  updateJobCounts: (id, args) => ResearchRepository.updateJobCounts(id, args),
  completeJob: (id, args) => ResearchRepository.completeJob(id, args),
  savePlan: (args) => ResearchRepository.savePlan(args),
  getPlan: (jobId) => ResearchRepository.getPlanByJobId(jobId),
  getPlanByJobId: (jobId) => ResearchRepository.getPlanByJobId(jobId),
  approvePlan: (jobId, feedback) => ResearchRepository.approvePlan(jobId, feedback),
  addQuery: (args) => ResearchRepository.addQuery(args),
  saveQuery: (args) => ResearchRepository.addQuery({ ...args, query: args.queryText || args.query }),
  addSource: (args) => ResearchRepository.addSource(args),
  saveSource: (args) => ResearchRepository.addSource({ ...args, category: args.sourceType || 'web', credibilityScore: args.confidenceScore || 0.7, isPrimarySource: Boolean(args.isPrimary) }),
  getSources: (jobId) => ResearchRepository.getSourcesByJobId(jobId),
  getSourcesByJobId: (jobId) => ResearchRepository.getSourcesByJobId(jobId),
  addEvidenceItem: (args) => ResearchRepository.addEvidenceItem(args),
  saveEvidenceBatch: (jobId, items) => ResearchRepository.saveEvidenceBatch(jobId, items),
  getEvidenceByJobId: (jobId) => ResearchRepository.getEvidenceByJobId(jobId),
  addClaim: (args) => ResearchRepository.addClaim(args),
  saveClaimsBatch: (jobId, claims) => ResearchRepository.saveClaimsBatch(jobId, claims),
  updateClaimVerification: (claimId, args) => ResearchRepository.updateClaimVerification(claimId, args),
  linkClaimEvidence: (claimId, evidenceId, rel) => ResearchRepository.linkClaimEvidence(claimId, evidenceId, rel),
  linkClaimEvidenceBatch: (links) => ResearchRepository.linkClaimEvidenceBatch(links),
  getClaims: (jobId) => ResearchRepository.getClaimsByJobId(jobId),
  getClaimsByJobId: (jobId) => ResearchRepository.getClaimsByJobId(jobId),
  addContradiction: (args) => ResearchRepository.addContradiction(args),
  getContradictionsByJobId: (jobId) => ResearchRepository.getContradictionsByJobId(jobId),
  getVerificationSummary: (jobId) => ResearchRepository.getVerificationSummary(jobId),
  saveSections: (jobId, sections) => ResearchRepository.saveSections(jobId, sections),
  saveSection: (args) => ResearchRepository.saveSections(args.jobId, [{ section_order: args.sectionOrder, title: args.title, content_markdown: args.contentMarkdown }]),
  getSections: (jobId) => ResearchRepository.getSectionsByJobId(jobId),
  getSectionsByJobId: (jobId) => ResearchRepository.getSectionsByJobId(jobId),
  saveQualityCheck: (args) => ResearchRepository.saveQualityCheck(args),
  getQualityCheckByJobId: (jobId) => ResearchRepository.getQualityCheckByJobId(jobId),
  saveArtifact: (args) => ResearchRepository.saveArtifact(args),
  getArtifacts: (jobId) => ResearchRepository.getArtifactsByJobId(jobId),
  recordRun: (args) => ResearchRepository.recordRun(args)
};
