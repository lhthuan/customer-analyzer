/**
 * export-handler.js
 * Export reconciliation results as CSV or XLSX.
 *
 * Exports: window.ExportHandler
 */
(function (global) {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────────────────────

  function dlBlob(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function stamp() { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }

  function csvEsc(v) {
    var s = String(v == null ? '' : v);
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes(';')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function toCSVBlob(headers, data2D) {
    var lines = [headers.map(csvEsc).join(',')];
    data2D.forEach(function (row) {
      lines.push(row.map(csvEsc).join(','));
    });
    return new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  }

  function toXLSX(headers, data2D, sheetName, filename) {
    try {
      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.aoa_to_sheet([headers].concat(data2D));
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, filename);
    } catch (e) {
      alert('Lỗi xuất XLSX: ' + e.message);
    }
  }

  // ── Matched records ────────────────────────────────────────────────────────

  var MATCHED_HEADERS = [
    'Match Type', 'Combined Score', 'Phone Score', 'Name Score',
    'ERP MaKH', 'ERP Name', 'ERP Phone', 'ERP HangThe', 'ERP Status',
    'Web Email', 'Web Full Name', 'Web Phone', 'Web Reg Date', 'Web Status'
  ];

  function matchedToRow(m) {
    var e = m.erpRecord || {};
    var w = m.webRecord || {};
    return [
      m.matchType       || '',
      m.combinedScore   || 0,
      m.phoneScore      || 0,
      m.nameScore       || 0,
      e.maKH    || '',
      e.name    || '',
      e.phone   || '',
      e.hangThe || '',
      e.status  || '',
      w.email    || '',
      w.fullName || '',
      w.rawPhone || '',
      w.regDate  || '',
      w.status   || ''
    ];
  }

  function exportMatchedCSV(matched) {
    if (!matched || !matched.length) { alert('Không có dữ liệu để xuất.'); return; }
    var data = matched.map(matchedToRow);
    dlBlob(toCSVBlob(MATCHED_HEADERS, data), 'matched_' + stamp() + '.csv');
  }

  function exportMatchedXLSX(matched) {
    if (!matched || !matched.length) { alert('Không có dữ liệu để xuất.'); return; }
    var data = matched.map(matchedToRow);
    toXLSX(MATCHED_HEADERS, data, 'Matched', 'matched_' + stamp() + '.xlsx');
  }

  // ── Unmatched ERP ──────────────────────────────────────────────────────────

  function unmatchedERPToRows(unmatchedIdxs, erpIndex) {
    return unmatchedIdxs.map(function (idx) {
      var cols = erpIndex.cols;
      var row  = erpIndex.rows[idx];
      if (!row) return [];
      return [
        cols.maKH    >= 0 ? (row[cols.maKH]    || '') : '',
        cols.name    >= 0 ? (row[cols.name]     || '') : '',
        cols.phone   >= 0 ? (row[cols.phone]    || '') : '',
        cols.hangThe >= 0 ? (row[cols.hangThe]  || '') : '',
        cols.dstl    >= 0 ? (row[cols.dstl]     || '') : '',
        cols.status  >= 0 ? (row[cols.status]   || '') : ''
      ];
    });
  }

  var ERP_HEADERS = ['MaKH', 'KhachHang', 'PhoneNo', 'HangThe', 'DSTL_2026', 'TrangThai'];

  function exportUnmatchedERPCSV(unmatchedIdxs, erpIndex) {
    if (!unmatchedIdxs || !unmatchedIdxs.length) { alert('Không có dữ liệu.'); return; }
    var data = unmatchedERPToRows(unmatchedIdxs, erpIndex);
    dlBlob(toCSVBlob(ERP_HEADERS, data), 'unmatched_erp_' + stamp() + '.csv');
  }

  function exportUnmatchedERPXLSX(unmatchedIdxs, erpIndex) {
    if (!unmatchedIdxs || !unmatchedIdxs.length) { alert('Không có dữ liệu.'); return; }
    var data = unmatchedERPToRows(unmatchedIdxs, erpIndex);
    toXLSX(ERP_HEADERS, data, 'Unmatched ERP', 'unmatched_erp_' + stamp() + '.xlsx');
  }

  // ── Unmatched Web ──────────────────────────────────────────────────────────

  var WEB_HEADERS = ['Email', 'Full Name', 'Phone', 'Registration Date', 'Status', 'Company', 'City'];

  function unmatchedWebToRows(unmatchedIdxs, webRecords) {
    return unmatchedIdxs.map(function (idx) {
      var w = webRecords[idx];
      if (!w) return [];
      return [w.email, w.fullName, w.rawPhone, w.regDate, w.status, w.company, w.city];
    });
  }

  function exportUnmatchedWebCSV(unmatchedIdxs, webRecords) {
    if (!unmatchedIdxs || !unmatchedIdxs.length) { alert('Không có dữ liệu.'); return; }
    var data = unmatchedWebToRows(unmatchedIdxs, webRecords);
    dlBlob(toCSVBlob(WEB_HEADERS, data), 'unmatched_web_' + stamp() + '.csv');
  }

  function exportUnmatchedWebXLSX(unmatchedIdxs, webRecords) {
    if (!unmatchedIdxs || !unmatchedIdxs.length) { alert('Không có dữ liệu.'); return; }
    var data = unmatchedWebToRows(unmatchedIdxs, webRecords);
    toXLSX(WEB_HEADERS, data, 'Unmatched Web', 'unmatched_web_' + stamp() + '.xlsx');
  }

  global.ExportHandler = {
    exportMatchedCSV:      exportMatchedCSV,
    exportMatchedXLSX:     exportMatchedXLSX,
    exportUnmatchedERPCSV: exportUnmatchedERPCSV,
    exportUnmatchedERPXLSX:exportUnmatchedERPXLSX,
    exportUnmatchedWebCSV: exportUnmatchedWebCSV,
    exportUnmatchedWebXLSX:exportUnmatchedWebXLSX
  };

})(window);
