/**
 * string-algorithms.js
 * String processing utilities:
 *  - Vietnamese diacritic removal
 *  - Phone normalization & validation
 *  - Name normalization
 *  - Jaro / Jaro-Winkler similarity
 *  - Levenshtein distance
 *  - phoneSimilarity / nameSimilarity scoring (0–100)
 */
(function (global) {
  'use strict';

  // ── Vietnamese diacritic map ───────────────────────────────────────────────
  var VIET_MAP = {
    'à':'a','á':'a','ả':'a','ã':'a','ạ':'a',
    'ă':'a','ằ':'a','ắ':'a','ẳ':'a','ẵ':'a','ặ':'a',
    'â':'a','ầ':'a','ấ':'a','ẩ':'a','ẫ':'a','ậ':'a',
    'è':'e','é':'e','ẻ':'e','ẽ':'e','ẹ':'e',
    'ê':'e','ề':'e','ế':'e','ể':'e','ễ':'e','ệ':'e',
    'ì':'i','í':'i','ỉ':'i','ĩ':'i','ị':'i',
    'ò':'o','ó':'o','ỏ':'o','õ':'o','ọ':'o',
    'ô':'o','ồ':'o','ố':'o','ổ':'o','ỗ':'o','ộ':'o',
    'ơ':'o','ờ':'o','ớ':'o','ở':'o','ỡ':'o','ợ':'o',
    'ù':'u','ú':'u','ủ':'u','ũ':'u','ụ':'u',
    'ư':'u','ừ':'u','ứ':'u','ử':'u','ữ':'u','ự':'u',
    'ỳ':'y','ý':'y','ỷ':'y','ỹ':'y','ỵ':'y','đ':'d',
    // Uppercase
    'À':'a','Á':'a','Ả':'a','Ã':'a','Ạ':'a',
    'Ă':'a','Ằ':'a','Ắ':'a','Ẳ':'a','Ẵ':'a','Ặ':'a',
    'Â':'a','Ầ':'a','Ấ':'a','Ẩ':'a','Ẫ':'a','Ậ':'a',
    'È':'e','É':'e','Ẻ':'e','Ẽ':'e','Ẹ':'e',
    'Ê':'e','Ề':'e','Ế':'e','Ể':'e','Ễ':'e','Ệ':'e',
    'Ì':'i','Í':'i','Ỉ':'i','Ĩ':'i','Ị':'i',
    'Ò':'o','Ó':'o','Ỏ':'o','Õ':'o','Ọ':'o',
    'Ô':'o','Ồ':'o','Ố':'o','Ổ':'o','Ỗ':'o','Ộ':'o',
    'Ơ':'o','Ờ':'o','Ớ':'o','Ở':'o','Ỡ':'o','Ợ':'o',
    'Ù':'u','Ú':'u','Ủ':'u','Ũ':'u','Ụ':'u',
    'Ư':'u','Ừ':'u','Ứ':'u','Ử':'u','Ữ':'u','Ự':'u',
    'Ỳ':'y','Ý':'y','Ỷ':'y','Ỹ':'y','Ỵ':'y','Đ':'d'
  };

  var VIET_REGEX = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/g;

  function removeVietnamese(s) {
    return s.replace(VIET_REGEX, function (c) { return VIET_MAP[c] || c; });
  }

  // ── Phone normalization ────────────────────────────────────────────────────

  /**
   * Normalize a phone number to Vietnamese format (0xxxxxxxxx).
   * Returns empty string if invalid.
   */
  function normalizePhone(phone) {
    if (!phone) return '';
    // Remove all non-digit characters (spaces, dashes, parens, plus, dots)
    var p = String(phone).replace(/[^\d]/g, '');
    // Convert 84xxxxxxxxx → 0xxxxxxxxx (Vietnam country code)
    if (p.length >= 11 && p.startsWith('84')) p = '0' + p.slice(2);
    // Validate: 9–11 digits, not all zeros
    if (p.length < 9 || p.length > 11) return '';
    if (/^0+$/.test(p)) return '';
    return p;
  }

  /** Returns true if the phone is valid after normalization. */
  function isValidPhone(phone) {
    return normalizePhone(phone) !== '';
  }

  // ── Name normalization ─────────────────────────────────────────────────────

  /** Lowercase + trim + remove Vietnamese diacritics + collapse spaces. */
  function normalizeName(name) {
    if (!name) return '';
    return removeVietnamese(
      String(name).toLowerCase().trim()
    ).replace(/\s+/g, ' ');
  }

  // ── Jaro similarity ────────────────────────────────────────────────────────

  function jaro(s1, s2) {
    if (s1 === s2) return 1.0;
    var l1 = s1.length, l2 = s2.length;
    if (!l1 || !l2) return 0.0;

    var matchDist = Math.floor(Math.max(l1, l2) / 2) - 1;
    if (matchDist < 0) matchDist = 0;

    var s1m = new Array(l1).fill(false);
    var s2m = new Array(l2).fill(false);
    var matches = 0;

    for (var i = 0; i < l1; i++) {
      var lo = Math.max(0, i - matchDist);
      var hi = Math.min(i + matchDist + 1, l2);
      for (var j = lo; j < hi; j++) {
        if (s2m[j] || s1[i] !== s2[j]) continue;
        s1m[i] = true; s2m[j] = true;
        matches++; break;
      }
    }

    if (!matches) return 0.0;

    var transpositions = 0, k = 0;
    for (var i = 0; i < l1; i++) {
      if (!s1m[i]) continue;
      while (!s2m[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }

    return (matches / l1 + matches / l2 + (matches - transpositions / 2) / matches) / 3;
  }

  // ── Jaro-Winkler similarity ────────────────────────────────────────────────

  function jaroWinkler(s1, s2, p) {
    p = p || 0.1;
    var j = jaro(s1, s2);
    if (j < 0.7) return j;
    var prefix = 0;
    var maxPfx = Math.min(4, s1.length, s2.length);
    for (var i = 0; i < maxPfx; i++) {
      if (s1[i] === s2[i]) prefix++; else break;
    }
    return j + prefix * p * (1 - j);
  }

  // ── Levenshtein distance ───────────────────────────────────────────────────

  function levenshtein(s1, s2) {
    var m = s1.length, n = s2.length;
    if (!m) return n;
    if (!n) return m;
    // Use two-row approach for memory efficiency
    var prev = new Array(n + 1);
    var curr = new Array(n + 1);
    for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      curr[0] = i;
      for (var j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          curr[j] = prev[j - 1];
        } else {
          curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
        }
      }
      var tmp = prev; prev = curr; curr = tmp;
    }
    return prev[n];
  }

  // ── phoneSimilarity score (0–100) ─────────────────────────────────────────

  /**
   * Compare two normalized phone numbers and return a score 0–100.
   *   100 — exact match
   *    98 — last-7 digits match
   *    90 — last-6 digits match
   *    70 — area code (first 4 digits) match
   *   0–69 — Levenshtein-based
   */
  function phoneSimilarity(p1, p2) {
    if (!p1 || !p2) return 0;
    if (p1 === p2) return 100;
    var tail7 = p1.slice(-7) === p2.slice(-7);
    var tail6 = p1.slice(-6) === p2.slice(-6);
    var area   = (p1.length >= 4 && p2.length >= 4 && p1.slice(0, 4) === p2.slice(0, 4));
    if (tail7) return 98;
    if (tail6) return 90;
    if (area)  return 70;
    var maxLen = Math.max(p1.length, p2.length);
    var dist = levenshtein(p1, p2);
    return Math.max(0, Math.round((1 - dist / maxLen) * 100));
  }

  // ── nameSimilarity score (0–100) ──────────────────────────────────────────

  /**
   * Compare two names (will be normalized internally) and return 0–100.
   *   100 — exact (after normalization)
   *    90 — ≥2 significant word parts match
   *   0–89 — Jaro-Winkler × 100
   */
  function nameSimilarity(n1, n2) {
    if (!n1 || !n2) return 0;
    var a = normalizeName(n1);
    var b = normalizeName(n2);
    if (!a || !b) return 0;
    if (a === b) return 100;

    // Check common significant words (length ≥ 2)
    var partsA = a.split(' ').filter(function (p) { return p.length >= 2; });
    var partsB = b.split(' ').filter(function (p) { return p.length >= 2; });
    var bSet = {};
    partsB.forEach(function (p) { bSet[p] = true; });
    var common = partsA.filter(function (p) { return bSet[p]; });
    if (common.length >= 2) return 90;

    return Math.round(jaroWinkler(a, b) * 100);
  }

  // ── Combined score ─────────────────────────────────────────────────────────

  /**
   * Combined score using the formula:
   *   combined = phoneScore * 0.75 + nameScore * 0.25
   */
  function combinedScore(phoneScore, nameScore) {
    return Math.round(phoneScore * 0.75 + nameScore * 0.25);
  }

  global.StringAlgorithms = {
    removeVietnamese: removeVietnamese,
    normalizePhone: normalizePhone,
    isValidPhone: isValidPhone,
    normalizeName: normalizeName,
    jaro: jaro,
    jaroWinkler: jaroWinkler,
    levenshtein: levenshtein,
    phoneSimilarity: phoneSimilarity,
    nameSimilarity: nameSimilarity,
    combinedScore: combinedScore
  };

})(window);
