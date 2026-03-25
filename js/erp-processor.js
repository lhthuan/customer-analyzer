/**
 * erp-processor.js
 * Process ERP data (already loaded via XLSX.js into mergedData).
 * Builds fast-lookup indexes for reconciliation.
 *
 * Exports: window.ERPProcessor
 */
(function (global) {
  'use strict';

  var SA = function () { return global.StringAlgorithms; };

  function yf() { return new Promise(function (r) { setTimeout(r, 0); }); }

  /**
   * Detect ERP column indices from the headers array.
   * Returns an object with keys: maKH, name, phone, hangThe, dstl, status, email
   * Values are column indices (or -1 if not found).
   */
  function detectERPColumns(headers) {
    function find(tests) {
      for (var i = 0; i < headers.length; i++) {
        var h = headers[i].toLowerCase().replace(/\s/g, '');
        for (var t = 0; t < tests.length; t++) {
          if (tests[t].test(h)) return i;
        }
      }
      return -1;
    }
    return {
      maKH:    find([/^makh$/, /makH/i]),
      name:    find([/^khachhang$/, /khachhang/, /^ten$/, /^kh$/]),
      phone:   find([/phoneno/, /phone/, /sdt/, /dienthoai/]),
      hangThe: find([/hangthe/]),
      dstl:    find([/dstl/]),
      status:  find([/trangthai/]),
      email:   find([/email/, /mail/])
    };
  }

  /**
   * Process ERP rows and build phone/email indexes.
   *
   * @param {string[]}  headers    - Column headers from mergedData
   * @param {any[][]}   rows       - Data rows from mergedData
   * @param {Function}  onProgress - (fraction 0-1, message) callback
   * @returns {Promise<ERPIndex>}
   *
   * ERPIndex shape:
   * {
   *   cols,           // detected column indices
   *   headers,        // original headers
   *   rows,           // original rows reference
   *   phoneIndex,     // Map<normalizedPhone, rowIdx[]>
   *   last7Index,     // Map<last7digits, rowIdx[]>
   *   last6Index,     // Map<last6digits, rowIdx[]>
   *   emailIndex,     // Map<email, rowIdx>  (first occurrence wins)
   *   stats: { total, validPhone, emptyPhone, invalidPhone }
   * }
   */
  async function processERPData(headers, rows, onProgress) {
    var cols = detectERPColumns(headers);
    var phoneIndex = new Map();
    var last7Index = new Map();
    var last6Index = new Map();
    var emailIndex = new Map();

    var validPhone = 0, emptyPhone = 0, invalidPhone = 0;
    var CHUNK = 50000;

    for (var i = 0; i < rows.length; i++) {
      if (i % CHUNK === 0) {
        if (onProgress) onProgress(i / rows.length,
          'Lập chỉ mục ERP: ' + i.toLocaleString() + ' / ' + rows.length.toLocaleString());
        await yf();
      }

      var row = rows[i];

      // Phone
      var rawPhone = cols.phone >= 0 ? String(row[cols.phone] || '') : '';
      var normPhone = SA().normalizePhone(rawPhone);

      if (!rawPhone.trim())   emptyPhone++;
      else if (!normPhone)    invalidPhone++;
      else                    validPhone++;

      if (normPhone) {
        if (!phoneIndex.has(normPhone))  phoneIndex.set(normPhone,  []);
        phoneIndex.get(normPhone).push(i);

        var t7 = normPhone.slice(-7);
        if (!last7Index.has(t7)) last7Index.set(t7, []);
        last7Index.get(t7).push(i);

        var t6 = normPhone.slice(-6);
        if (!last6Index.has(t6)) last6Index.set(t6, []);
        last6Index.get(t6).push(i);
      }

      // Email
      if (cols.email >= 0) {
        var email = String(row[cols.email] || '').toLowerCase().trim();
        if (email && !emailIndex.has(email)) emailIndex.set(email, i);
      }
    }

    return {
      cols: cols,
      headers: headers,
      rows: rows,
      phoneIndex: phoneIndex,
      last7Index: last7Index,
      last6Index: last6Index,
      emailIndex: emailIndex,
      stats: {
        total: rows.length,
        validPhone: validPhone,
        emptyPhone: emptyPhone,
        invalidPhone: invalidPhone
      }
    };
  }

  /**
   * Get a plain record object for a given row index.
   */
  function getERPRecord(erpIndex, rowIdx) {
    var cols = erpIndex.cols;
    var row = erpIndex.rows[rowIdx];
    if (!row) return null;
    return {
      rowIdx: rowIdx,
      maKH:    cols.maKH    >= 0 ? String(row[cols.maKH]    || '') : '',
      name:    cols.name    >= 0 ? String(row[cols.name]    || '') : '',
      phone:   cols.phone   >= 0 ? String(row[cols.phone]   || '') : '',
      hangThe: cols.hangThe >= 0 ? String(row[cols.hangThe] || '') : '',
      dstl:    cols.dstl    >= 0 ? (row[cols.dstl] || '') : '',
      status:  cols.status  >= 0 ? String(row[cols.status]  || '') : '',
      email:   cols.email   >= 0 ? String(row[cols.email]   || '').toLowerCase().trim() : ''
    };
  }

  global.ERPProcessor = {
    detectERPColumns: detectERPColumns,
    processERPData: processERPData,
    getERPRecord: getERPRecord
  };

})(window);
