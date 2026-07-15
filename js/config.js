/**
 * ======================= CONFIGURATION =======================
 * Lecturer settings — edit this file only.
 */
const CONFIG = {
  /**
   * Google Apps Script Web App URL used to record marks into your
   * Google Spreadsheet. Leave as "" to run without recording.
   */
  SHEETS_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbwUHXNPH5__mM2MJA9sefLWafCUriEg1qdzGAppNCuFJ_iv_XZKnrrrbnCXjhja8nlC/exec",

  /** Assessment title written into the spreadsheet. */
  ASSESSMENT_NAME: "PPS2114 C++ Assessment - July 2026",

  /**
   * Wandbox public code-execution API (free, no key required).
   * "gcc-head" is always available; you may pin e.g. "gcc-13.2.0".
   */
  WANDBOX_URL: "https://wandbox.org/api/compile.json",
  WANDBOX_COMPILER: "gcc-head",

  /** Seconds to wait for a compile/run request before giving up. */
  RUN_TIMEOUT_MS: 20000
};
