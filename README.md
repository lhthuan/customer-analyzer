# Customer Analyzer

A client-side web application for analyzing and reconciling customer data from ERP and Web systems — no backend required.

## Features

### Core Tabs
| Tab | Description |
|-----|-------------|
| 🔍 Tra cứu KH | Search customers by code / name / phone with debounce |
| ⚙️ Lọc & Truy vấn | Multi-condition filter with AND/OR logic + SQL preview |
| 📊 Thống kê | Bar charts for tier, status, branch, revenue distribution |
| 🧮 Phân tích cột | Per-column statistics (min, max, avg, unique, type) |
| 🔄 Web Sync | **Web ↔ ERP Reconciliation Tool** (new) |

### 🔄 Web Sync — Reconciliation Tool

Match Web customer records against ERP data using a 4-phase algorithm:

1. **Exact Phone Match** (100% phone score)
2. **Fuzzy Phone Match** — last-7 digits (98%), last-6 digits (90%), area code (70%)
3. **Email Match** (fixed 95% combined score)
4. **Name-only Match** (Jaro-Winkler ≥ 90%, below export threshold)

**Scoring formula:** `combined = phoneScore × 0.75 + nameScore × 0.25`
Only records with **combined ≥ 95%** are exported as definite matches.

## Supported File Formats

- **ERP:** `.xlsb`, `.xlsx`, `.xls` — loaded via XLSX.js
- **Web:** `.csv` — semicolon (`;`) or comma (`,`) delimiter, quoted fields supported

## Usage

### Load ERP Data
1. Open the app (`index.html` — works directly from browser or GitHub Pages)
2. Drag & drop or click **"Tải file"** to upload an ERP file (`.xlsb`, `.xlsx`, etc.)
3. Select the sheet containing customer records

### Run Reconciliation (Web Sync Tab)
1. Switch to the **🔄 Web Sync** tab
2. The ERP data loaded in the main tab is used automatically
3. Upload your **Web CSV file** (click or drag-and-drop)
4. Review the **phone quality check** for both datasets
5. Click **▶ Chạy đối soát** to start matching
6. View results in three sub-tabs:
   - **✓ Đã khớp** — records matched with ≥ 95% confidence
   - **✗ Chưa khớp** — unmatched ERP and Web records
   - **📊 Báo cáo** — summary statistics
7. Export results as **CSV** or **XLSX**

## Web CSV Format

Expected column headers (semicolon-delimited):
```
E-mail;First name;Last name;Phone;Registration date;Status;Company;Billing: address;Billing: city;Billing: state
```

The parser auto-detects the delimiter (`;` or `,`) and handles quoted fields.

## ERP Data Format

Columns: `STT, MaKH, KhachHang, PhoneNo, HangThe, DSTL_2026, NgayTaoThe, ChiNhanhTaoThe, ChiNhanhMuaGanNhat, ChiNhanhMuaNhieuNhat, TrangThai`

## Technical Architecture

```
index.html              — Main UI (single-page, tabs)
js/
  csv-parser.js         — CSV parser (semicolon/comma, quoted fields, BOM)
  string-algorithms.js  — Levenshtein, Jaro-Winkler, Vietnamese diacritics, 
                          phone/name normalization, similarity scoring
  erp-processor.js      — ERP data indexing (phone/email hash maps)
  web-processor.js      — Web CSV parsing & normalization
  reconciliation-engine.js — 4-phase matching engine (async, chunked)
  export-handler.js     — CSV/XLSX export for matched & unmatched records
```

### Phone Normalization Rules
- Remove spaces, dashes, parentheses: `090 123-4567` → `0901234567`
- Convert Vietnam country code: `84901234567` → `0901234567`
- Validate: 9–11 digits, not all zeros
- Invalid phones (too short/long, all zeros) → skipped

### Name Normalization Rules
- Lowercase + trim
- Remove Vietnamese diacritics (à→a, ă→a, ơ→o, đ→d, etc.)
- Collapse multiple spaces to single space

### Performance
- **Chunked async processing** with `setTimeout(0)` yields between chunks
- Phone index hash maps for O(1) lookup (no N×M scan for Phases 1–3)
- Phase 4 (name-only) limited to first 100K ERP records
- Preview tables limited to 500 rows; full data available via export

## Deployment

- **No backend required** — pure client-side JavaScript
- **GitHub Pages compatible** — just push to `main` branch
- No login, no data storage — files processed entirely in-browser
- Works offline after first load (except Google Fonts)
