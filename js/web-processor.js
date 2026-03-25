/**
 * web-processor.js
 * Parse and normalize Web customer CSV data.
 * Expected columns (semicolon-delimited):
 *   E-mail; First name; Last name; Phone; Registration date; Status;
 *   Company; Billing: address; Billing: city; Billing: state
 *
 * Exports: window.WebProcessor
 */
(function (global) {
  'use strict';

  var SA  = function () { return global.StringAlgorithms; };
  var CSV = function () { return global.CSVParser; };

  /**
   * Detect Web-CSV column indices from the headers array.
   */
  function detectWebColumns(headers) {
    function find(tests) {
      for (var i = 0; i < headers.length; i++) {
        var h = headers[i].toLowerCase().replace(/[\s:_\-]/g, '');
        for (var t = 0; t < tests.length; t++) {
          if (tests[t].test(h)) return i;
        }
      }
      return -1;
    }
    return {
      email:     find([/^email$/, /^e-mail$/, /^mail$/]),
      firstName: find([/^firstname$/, /^first$/]),
      lastName:  find([/^lastname$/, /^last$/]),
      phone:     find([/^phone$/, /^sdt$/, /^dienthoai$/]),
      regDate:   find([/registrationdate/, /regdate/, /ngaydangky/]),
      status:    find([/^status$/, /trangthai/]),
      company:   find([/company/, /congty/]),
      address:   find([/billingaddress/, /^address$/]),
      city:      find([/billingcity/, /^city$/, /^tinh$/, /^thanhpho$/]),
      state:     find([/billingstate/, /^state$/])
    };
  }

  /**
   * Parse Web CSV text and return normalized records.
   *
   * @param {string}   csvText    - Raw CSV file content
   * @param {Function} onProgress - (fraction, message) callback
   * @returns {Promise<WebData>}
   *
   * WebData shape:
   * {
   *   cols,      // detected column indices
   *   headers,   // original headers
   *   records,   // WebRecord[]
   *   emailIndex,// Map<email, recordIdx>
   *   phoneIndex,// Map<normalizedPhone, recordIdx[]>
   *   stats: { total, validPhone, emptyPhone, invalidPhone }
   * }
   */
  async function processWebData(csvText, onProgress) {
    function yf() { return new Promise(function (r) { setTimeout(r, 0); }); }

    // Auto-detect delimiter
    var delim = CSV().detectDelimiter(csvText);
    var parsed = CSV().parseCSV(csvText, delim);
    var headers = parsed.headers;
    var rows    = parsed.rows;
    var cols    = detectWebColumns(headers);

    var records    = [];
    var emailIndex = new Map();
    var phoneIndex = new Map();
    var validPhone = 0, emptyPhone = 0, invalidPhone = 0;

    var CHUNK = 20000;

    for (var i = 0; i < rows.length; i++) {
      if (i % CHUNK === 0) {
        if (onProgress) onProgress(i / rows.length,
          'Xử lý Web CSV: ' + i.toLocaleString() + ' / ' + rows.length.toLocaleString());
        await yf();
      }

      var row = rows[i];
      var get = function (ci) { return ci >= 0 ? String(row[ci] || '') : ''; };

      var firstName = get(cols.firstName).trim();
      var lastName  = get(cols.lastName).trim();
      var fullName  = (firstName + ' ' + lastName).trim() || (lastName || firstName);
      var email     = get(cols.email).toLowerCase().trim();
      var rawPhone  = get(cols.phone);
      var normPhone = SA().normalizePhone(rawPhone);

      if (!rawPhone.trim()) emptyPhone++;
      else if (!normPhone)  invalidPhone++;
      else                  validPhone++;

      var rec = {
        idx:       i,
        email:     email,
        firstName: firstName,
        lastName:  lastName,
        fullName:  fullName,
        phone:     normPhone,
        rawPhone:  rawPhone,
        regDate:   get(cols.regDate),
        status:    get(cols.status),
        company:   get(cols.company),
        address:   get(cols.address),
        city:      get(cols.city),
        state:     get(cols.state)
      };
      records.push(rec);

      if (email && !emailIndex.has(email)) emailIndex.set(email, i);

      if (normPhone) {
        if (!phoneIndex.has(normPhone)) phoneIndex.set(normPhone, []);
        phoneIndex.get(normPhone).push(i);
      }
    }

    return {
      cols:       cols,
      headers:    headers,
      records:    records,
      emailIndex: emailIndex,
      phoneIndex: phoneIndex,
      stats: {
        total:        rows.length,
        validPhone:   validPhone,
        emptyPhone:   emptyPhone,
        invalidPhone: invalidPhone
      }
    };
  }

  global.WebProcessor = {
    detectWebColumns: detectWebColumns,
    processWebData: processWebData
  };

})(window);
