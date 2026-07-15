/**
 * ======================= CONFIGURATION =======================
 * Lecturer settings — edit this file only.
 */
const CONFIG = {
  /**
   * Google Apps Script Web App URL used to record marks into your
   * Google Spreadsheet. Follow README.md ("Google Sheets setup")
   * to deploy the script, then paste the /exec URL here.
   * Leave as "" to run the quiz without recording (results still shown).
   */
  SHEETS_WEBAPP_URL: "",

  /** Assessment title written into the spreadsheet (lets you reuse one sheet for several quizzes). */
  ASSESSMENT_NAME: "PPS2114 C++ Assessment - July 2026",

  /**
   * Wandbox public code-execution API (free, no key required).
   * Used to compile and run student C++ code against test cases.
   * Compiler list: https://wandbox.org/ (dropdown) — "gcc-head" is
   * always available; you may pin e.g. "gcc-13.2.0".
   */
  WANDBOX_URL: "https://wandbox.org/api/compile.json",
  WANDBOX_COMPILER: "gcc-head",

  /** Seconds to wait for a compile/run request before giving up. */
  RUN_TIMEOUT_MS: 20000
};
