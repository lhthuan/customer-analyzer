/**
 * reconciliation-engine.js
 * Web ↔ ERP reconciliation using a 4-phase matching strategy.
 *
 * Phases (stop when match found):
 *   1. Exact phone match          → phoneScore=100, name verified
 *   2. Fuzzy phone match          → last-7/last-6/area-code, name verified
 *   3. Email exact match          → fixed combinedScore=95
 *   4. Name similarity (limited)  → Jaro-Winkler ≥90%, max score=90
 *
 * Scoring:
 *   combinedScore = phoneScore*0.75 + nameScore*0.25
 *   Export threshold: combinedScore ≥ 95
 *
 * Exports: window.ReconciliationEngine
 */
(function (global) {
  'use strict';

  var SA  = function () { return global.StringAlgorithms; };
  var ERP = function () { return global.ERPProcessor; };

  function yf() { return new Promise(function (r) { setTimeout(r, 0); }); }

  // Match type labels
  var MATCH_TYPE = {
    EXACT_PHONE:  'Exact Phone',
    FUZZY_LAST7:  'Fuzzy L7',
    FUZZY_LAST6:  'Fuzzy L6',
    FUZZY_AREA:   'Fuzzy Area',
    EMAIL:        'Email',
    NAME:         'Name'
  };

  /**
   * Find the best ERP candidate(s) from a set of row indices.
   * Returns the best match: { erpRowIdx, erpRecord, phoneScore, nameScore, combinedScore, matchType }
   * or null if no candidate reaches the threshold.
   *
   * @param {number[]}  candidates   - ERP row indices to check
   * @param {string}    normPhone    - Normalized web phone
   * @param {string}    webName      - Web full name
   * @param {ERPIndex}  erpIndex
   * @param {number}    minScore     - Minimum combined score required
   * @param {string}    matchType    - Label for the match type
   */
  function findBestCandidate(candidates, normPhone, webName, erpIndex, minScore, matchType) {
    var best = null;
    for (var ci = 0; ci < candidates.length; ci++) {
      var rowIdx = candidates[ci];
      var rec = ERP().getERPRecord(erpIndex, rowIdx);
      if (!rec) continue;

      var erpNormPhone = SA().normalizePhone(rec.phone);
      var phoneScore = SA().phoneSimilarity(normPhone, erpNormPhone);
      var nameScore  = rec.name ? SA().nameSimilarity(webName, rec.name) : 0;
      var combined   = SA().combinedScore(phoneScore, nameScore);

      if (combined >= minScore) {
        if (!best || combined > best.combinedScore) {
          best = {
            erpRowIdx:    rowIdx,
            erpRecord:    rec,
            phoneScore:   phoneScore,
            nameScore:    nameScore,
            combinedScore: combined,
            matchType:    matchType
          };
        }
      }
    }
    return best;
  }

  /**
   * Run the full reconciliation.
   *
   * @param {ERPIndex}  erpIndex  - Output from ERPProcessor.processERPData
   * @param {WebData}   webData   - Output from WebProcessor.processWebData
   * @param {Function}  onProgress - (fraction, message) callback
   * @returns {Promise<ReconciliationResult>}
   *
   * ReconciliationResult shape:
   * {
   *   matched:      MatchedRecord[],
   *   unmatchedERP: number[],   // ERP row indices
   *   unmatchedWeb: number[],   // Web record indices
   *   suspicious:   SuspiciousRecord[],
   *   stats: { ... }
   * }
   */
  async function reconcile(erpIndex, webData, onProgress) {
    var EXPORT_THRESHOLD    = 95; // combined score required for export
    var SUSPICIOUS_MIN      = 85; // combined score for suspicious flag
    var NAME_PHASE4_MIN     = 90; // Jaro-Winkler % threshold for phase 4
    var PHASE4_ERP_LIMIT    = 100000; // max ERP rows to scan in name-only phase

    var matched      = [];
    var suspicious   = [];
    var matchedERPSet = new Set(); // ERP row indices that were matched

    var webRecords = webData.records;
    var total      = webRecords.length;

    var CHUNK = 5000;

    for (var wi = 0; wi < total; wi++) {
      if (wi % CHUNK === 0) {
        if (onProgress) onProgress(
          wi / total,
          'Đối soát: ' + wi.toLocaleString() + ' / ' + total.toLocaleString() + ' bản ghi Web'
        );
        await yf();
      }

      var wrec     = webRecords[wi];
      var normPhone = wrec.phone;  // already normalized
      var webName   = wrec.fullName;
      var webEmail  = wrec.email;
      var result    = null;

      // ── Phase 1: Exact phone match ────────────────────────────────────────
      if (normPhone && erpIndex.phoneIndex.has(normPhone)) {
        var candidates = erpIndex.phoneIndex.get(normPhone);
        result = findBestCandidate(candidates, normPhone, webName, erpIndex, EXPORT_THRESHOLD, MATCH_TYPE.EXACT_PHONE);
        // If no match exceeds threshold, try fuzzy name (suspicious)
        if (!result) {
          var suspResult = findBestCandidate(candidates, normPhone, webName, erpIndex, SUSPICIOUS_MIN, MATCH_TYPE.EXACT_PHONE);
          if (suspResult) {
            suspResult.webIdx = wi;
            suspResult.webRecord = wrec;
            suspicious.push(suspResult);
            continue;
          }
        }
      }

      // ── Phase 2: Fuzzy phone match ────────────────────────────────────────
      if (!result && normPhone) {
        // 2a: Last 7 digits
        var t7 = normPhone.slice(-7);
        if (erpIndex.last7Index.has(t7)) {
          var cands7 = erpIndex.last7Index.get(t7).filter(function (idx) {
            return SA().normalizePhone(erpIndex.rows[idx][erpIndex.cols.phone >= 0 ? erpIndex.cols.phone : -1] || '') !== normPhone;
          });
          result = findBestCandidate(cands7, normPhone, webName, erpIndex, EXPORT_THRESHOLD, MATCH_TYPE.FUZZY_LAST7);
        }

        // 2b: Last 6 digits
        if (!result) {
          var t6 = normPhone.slice(-6);
          if (erpIndex.last6Index.has(t6)) {
            var cands6 = erpIndex.last6Index.get(t6).filter(function (idx) {
              var ep = SA().normalizePhone(erpIndex.rows[idx][erpIndex.cols.phone >= 0 ? erpIndex.cols.phone : -1] || '');
              return ep !== normPhone && ep.slice(-7) !== normPhone.slice(-7);
            });
            result = findBestCandidate(cands6, normPhone, webName, erpIndex, EXPORT_THRESHOLD, MATCH_TYPE.FUZZY_LAST6);
          }
        }
      }

      // ── Phase 3: Email exact match ────────────────────────────────────────
      if (!result && webEmail && erpIndex.emailIndex.has(webEmail)) {
        var erpRowIdx = erpIndex.emailIndex.get(webEmail);
        var erpRec    = ERP().getERPRecord(erpIndex, erpRowIdx);
        if (erpRec) {
          result = {
            erpRowIdx:    erpRowIdx,
            erpRecord:    erpRec,
            phoneScore:   0,
            nameScore:    erpRec.name ? SA().nameSimilarity(webName, erpRec.name) : 0,
            combinedScore: 95,
            matchType:    MATCH_TYPE.EMAIL
          };
        }
      }

      // ── Phase 4: Name-only match (limited, below threshold) ───────────────
      if (!result) {
        // Scan up to PHASE4_ERP_LIMIT unmatched ERP records
        var erpScanLimit = Math.min(erpIndex.rows.length, PHASE4_ERP_LIMIT);
        var bestNameScore = 0;
        var bestNameRowIdx = -1;

        if (webName) {
          var normWebName = SA().normalizeName(webName);
          for (var ei = 0; ei < erpScanLimit; ei++) {
            if (matchedERPSet.has(ei)) continue;
            var erpRow = erpIndex.rows[ei];
            var erpNameRaw = erpIndex.cols.name >= 0 ? String(erpRow[erpIndex.cols.name] || '') : '';
            if (!erpNameRaw) continue;
            var ns = SA().nameSimilarity(webName, erpNameRaw);
            if (ns > bestNameScore) {
              bestNameScore = ns;
              bestNameRowIdx = ei;
              if (ns >= 100) break; // exact match
            }
          }
        }

        if (bestNameScore >= NAME_PHASE4_MIN && bestNameRowIdx >= 0) {
          var ph4Rec = ERP().getERPRecord(erpIndex, bestNameRowIdx);
          // Phase 4 scores are below export threshold (max ~22.5 combined)
          // but we flag them as suspicious for manual review
          suspicious.push({
            erpRowIdx:     bestNameRowIdx,
            erpRecord:     ph4Rec,
            phoneScore:    0,
            nameScore:     bestNameScore,
            combinedScore: Math.round(bestNameScore * 0.25), // formula with phone=0
            matchType:     MATCH_TYPE.NAME,
            webIdx:        wi,
            webRecord:     wrec
          });
          continue;
        }
        // Truly no match
        continue;
      }

      // ── Record the match ──────────────────────────────────────────────────
      if (result) {
        result.webIdx    = wi;
        result.webRecord = wrec;
        matched.push(result);
        matchedERPSet.add(result.erpRowIdx);
      }
    }

    // Build unmatched lists
    var unmatchedWebSet = new Set();
    matched.forEach(function (m) { unmatchedWebSet.add(m.webIdx); });
    suspicious.forEach(function (s) { unmatchedWebSet.add(s.webIdx); });
    var unmatchedWeb = [];
    for (var wi = 0; wi < total; wi++) {
      if (!unmatchedWebSet.has(wi)) unmatchedWeb.push(wi);
    }

    var unmatchedERP = [];
    for (var ei = 0; ei < erpIndex.rows.length; ei++) {
      if (!matchedERPSet.has(ei)) unmatchedERP.push(ei);
    }

    var highConf = matched.filter(function (m) { return m.combinedScore >= 95; }).length;

    return {
      matched:      matched,
      unmatchedERP: unmatchedERP,
      unmatchedWeb: unmatchedWeb,
      suspicious:   suspicious,
      stats: {
        totalERP:     erpIndex.rows.length,
        totalWeb:     total,
        matched:      matched.length,
        unmatchedERP: unmatchedERP.length,
        unmatchedWeb: unmatchedWeb.length,
        suspicious:   suspicious.length,
        highConf:     highConf,
        matchRate:    total > 0 ? (matched.length / total * 100).toFixed(1) : '0.0',
        highConfPct:  matched.length > 0 ? (highConf / matched.length * 100).toFixed(1) : '0.0',
        byType: (function () {
          var m = {};
          matched.forEach(function (r) {
            m[r.matchType] = (m[r.matchType] || 0) + 1;
          });
          return m;
        })()
      }
    };
  }

  global.ReconciliationEngine = {
    reconcile: reconcile,
    MATCH_TYPE: MATCH_TYPE
  };

})(window);
