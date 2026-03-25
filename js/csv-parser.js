/**
 * csv-parser.js
 * Parse CSV files with configurable delimiter (default: semicolon) and quoted-field support.
 * Handles: escaped quotes (""), newlines inside quoted fields, BOM prefix.
 */
(function (global) {
  'use strict';

  /**
   * Parse CSV text.
   * @param {string} text       - Raw CSV content
   * @param {string} delimiter  - Field delimiter (default ";")
   * @returns {{ headers: string[], rows: string[][] }}
   */
  function parseCSV(text, delimiter) {
    delimiter = delimiter || ';';

    // Strip UTF-8 BOM if present
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    var rows = [];
    var i = 0;
    var len = text.length;

    while (i < len) {
      var row = [];
      // Parse fields in one row
      while (i < len) {
        var field = '';
        if (text[i] === '"') {
          // Quoted field
          i++; // skip opening quote
          while (i < len) {
            if (text[i] === '"') {
              if (i + 1 < len && text[i + 1] === '"') {
                // Escaped double-quote
                field += '"';
                i += 2;
              } else {
                i++; // skip closing quote
                break;
              }
            } else {
              field += text[i++];
            }
          }
          // After closing quote, skip whitespace until delimiter/newline
          while (i < len && text[i] !== delimiter && text[i] !== '\n' && text[i] !== '\r') {
            i++;
          }
        } else {
          // Unquoted field — read until delimiter or newline
          while (i < len && text[i] !== delimiter && text[i] !== '\n' && text[i] !== '\r') {
            field += text[i++];
          }
          field = field.trim();
        }
        row.push(field);

        if (i < len && text[i] === delimiter) {
          i++; // consume delimiter and continue this row
        } else {
          // End of row — consume line ending
          if (i < len && text[i] === '\r') i++;
          if (i < len && text[i] === '\n') i++;
          break;
        }
      }
      // Skip completely empty rows
      if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
        rows.push(row);
      }
    }

    if (!rows.length) return { headers: [], rows: [] };

    var headers = rows[0].map(function (h) { return h.trim(); });
    var dataRows = rows.slice(1).filter(function (r) {
      return r.some(function (c) { return c !== ''; });
    });

    return { headers: headers, rows: dataRows };
  }

  /**
   * Auto-detect the delimiter in a CSV text by sampling the first few lines.
   * Returns the most likely delimiter among [';', ',', '\t', '|'].
   */
  function detectDelimiter(text) {
    var sample = text.slice(0, 2000);
    var delimiters = [';', ',', '\t', '|'];
    var best = ';';
    var bestCount = 0;
    delimiters.forEach(function (d) {
      var count = (sample.split(d).length - 1);
      if (count > bestCount) { bestCount = count; best = d; }
    });
    return best;
  }

  global.CSVParser = { parseCSV: parseCSV, detectDelimiter: detectDelimiter };

})(window);
