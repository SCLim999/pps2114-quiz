/**
 * PPS2114 C++ Assessment — main application logic.
 * Renders questions, generates feedback, grades answers,
 * and records marks to Google Sheets via Apps Script.
 */
(function () {
  "use strict";

  // ---------- state ----------
  const state = {
    student: { name: "", id: "", klass: "" },
    startedAt: null,
    // theory: { [qid]: { selected: number|null, checked: bool, correct: bool, attempts: number } }
    theory: {},
    // coding: { [qid]: { code: string, runs: number, lastResult: {passed, total, feedback[]} | null } }
    coding: {},
    submitted: false
  };

  const $ = (sel) => document.querySelector(sel);

  // ---------- helpers ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /** Render `code` spans for backtick-quoted fragments. */
  function fmt(s) {
    return escapeHtml(s).replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  /** Whitespace-tolerant output comparison (per line, trimmed, blank lines ignored). */
  function outputsMatch(actual, expected) {
    const norm = (t) =>
      String(t).replace(/\r/g, "").split("\n")
        .map((l) => l.trim().replace(/\s+/g, " "))
        .filter((l) => l.length > 0)
        .join("\n");
    return norm(actual) === norm(expected);
  }

  // ============================================================
  // START SCREEN
  // ============================================================
  $("#student-form").addEventListener("submit", (e) => {
    e.preventDefault();
    state.student.name = $("#student-name").value.trim();
    state.student.id = $("#student-id").value.trim();
    state.student.klass = $("#student-class").value.trim();
    state.startedAt = new Date();

    $("#student-badge").textContent = `${state.student.name} (${state.student.id})`;
    $("#start-screen").classList.add("hidden");
    $("#quiz-screen").classList.remove("hidden");
    renderTheory();
    renderCoding();
    updateProgress();
    window.scrollTo(0, 0);
  });

  function updateProgress() {
    const parts = [];
    if (THEORY_QUESTIONS.length) {
      const tDone = Object.values(state.theory).filter((t) => t.checked).length;
      parts.push(`Theory ${tDone}/${THEORY_QUESTIONS.length}`);
    }
    const cDone = Object.values(state.coding).filter((c) => c.lastResult).length;
    parts.push(`Questions attempted ${cDone}/${CODING_QUESTIONS.length}`);
    $("#progress-badge").textContent = parts.join(" · ");
  }

  // ============================================================
  // SECTION A — THEORY
  // ============================================================
  function renderTheory() {
    // Hide the whole theory section when no theory questions are configured
    $("#theory-section").classList.toggle("hidden", THEORY_QUESTIONS.length === 0);

    const container = $("#theory-container");
    container.innerHTML = "";

    THEORY_QUESTIONS.forEach((q, qi) => {
      state.theory[q.id] = { selected: null, checked: false, correct: false, attempts: 0 };

      const card = document.createElement("div");
      card.className = "card question-card";
      card.innerHTML = `
        <span class="q-number">Question A${qi + 1}</span>
        <span class="q-marks">[${q.marks} mark${q.marks > 1 ? "s" : ""}]</span>
        <p class="q-text">${fmt(q.text)}</p>
        ${q.code ? `<pre class="code-snippet">${escapeHtml(q.code)}</pre>` : ""}
        <div class="options"></div>
        <button class="btn btn-secondary check-answer-btn">Check Answer</button>
        <div class="feedback-slot"></div>
      `;

      const optBox = card.querySelector(".options");
      q.options.forEach((opt, oi) => {
        const label = document.createElement("label");
        label.className = "option";
        label.innerHTML = `
          <input type="radio" name="opt-${q.id}" value="${oi}">
          <span class="option-label">${fmt(opt)}</span>
        `;
        label.querySelector("input").addEventListener("change", () => {
          if (state.theory[q.id].checked) return;
          state.theory[q.id].selected = oi;
          optBox.querySelectorAll(".option").forEach((el) => el.classList.remove("selected"));
          label.classList.add("selected");
        });
        optBox.appendChild(label);
      });

      card.querySelector(".check-answer-btn").addEventListener("click", () => {
        const st = state.theory[q.id];
        if (st.checked) return;
        if (st.selected === null) {
          showFeedback(card, "info", "Please select an option first.");
          return;
        }
        st.checked = true;
        st.attempts += 1;
        st.correct = st.selected === q.answer;

        // lock options and colour them
        optBox.querySelectorAll(".option").forEach((el, oi) => {
          el.classList.add("locked");
          el.querySelector("input").disabled = true;
          if (oi === q.answer) el.classList.add("correct");
          else if (oi === st.selected) el.classList.add("wrong");
        });
        card.querySelector(".check-answer-btn").disabled = true;

        const explain = Array.isArray(q.explain) ? q.explain[st.selected] : q.explain;
        const head = st.correct
          ? `✔ Correct! (+${q.marks} marks)`
          : `✘ Incorrect. The correct answer is: ${q.options[q.answer]}`;
        showFeedback(card, st.correct ? "good" : "bad", `${head}\n${explain || ""}`);
        updateProgress();
      });

      container.appendChild(card);
    });
  }

  function showFeedback(card, kind, text) {
    const slot = card.querySelector(".feedback-slot");
    slot.innerHTML = `<div class="feedback ${kind}">${fmt(text)}</div>`;
  }

  // ============================================================
  // SECTION B — CODING
  // ============================================================
  function renderCoding() {
    // With no theory section there is only one section — drop the "B" labels
    const hasTheory = THEORY_QUESTIONS.length > 0;
    if (!hasTheory) $("#coding-title").textContent = "C++ Coding Questions";
    const qPrefix = hasTheory ? "B" : "";

    const container = $("#coding-container");
    container.innerHTML = "";

    CODING_QUESTIONS.forEach((q, qi) => {
      state.coding[q.id] = { code: q.starter, runs: 0, lastResult: null };

      const isDebug = q.kind === "debug";
      const card = document.createElement("div");
      card.className = "card question-card";
      card.innerHTML = `
        <span class="q-number${isDebug ? " q-debug" : ""}">Question ${qPrefix}${qi + 1}${isDebug ? " · 🐞 Debugging" : ""}</span>
        <span class="q-marks">[${q.marks} marks — ${q.title}]</span>
        <p class="q-text">${fmt(q.text)}</p>
        ${q.example ? `<pre class="code-snippet">${escapeHtml(q.example)}</pre>` : ""}
        <textarea class="code-editor" spellcheck="false"></textarea>
        <div class="editor-toolbar">
          <button class="btn btn-primary run-btn">▶ Run &amp; Check</button>
          <button class="btn btn-secondary reset-btn">Reset Code</button>
          <span class="run-status"></span>
        </div>
        <div class="feedback-slot"></div>
        <div class="tests-slot"></div>
      `;

      const ide = mountTurboIde(card, q);
      const editor = card.querySelector(".code-editor");
      if (editor) {
        editor.value = q.starter;
        editor.addEventListener("input", () => { state.coding[q.id].code = editor.value; });
        // Tab inserts spaces instead of leaving the editor
        editor.addEventListener("keydown", (e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            const s = editor.selectionStart;
            editor.value = editor.value.slice(0, s) + "    " + editor.value.slice(editor.selectionEnd);
            editor.selectionStart = editor.selectionEnd = s + 4;
            state.coding[q.id].code = editor.value;
          }
        });
      }

      card.querySelector(".reset-btn").addEventListener("click", () => {
        if (confirm("Reset this question's code to the starter template?")) {
          state.coding[q.id].code = q.starter;
          if (ide) ide.setCode(q.starter);
          else editor.value = q.starter;
        }
      });

      card.querySelector(".run-btn").addEventListener("click", () => runCodingQuestion(q, card));

      container.appendChild(card);
    });
  }

  /** DOS 8.3 file name for a question, e.g. "c1" -> "C1.CPP". */
  function qFileName(q) {
    return String(q.id).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) + ".CPP";
  }

  /**
   * Replace the plain textarea with the Turbo C++ 3.0 emulation
   * (js/turbo.js). Falls back silently to the textarea when the
   * emulation is switched off in config.js or fails to load.
   * Returns the IDE instance, or null.
   */
  function mountTurboIde(card, q) {
    if (CONFIG.TURBO_IDE === false || typeof TurboIDE === "undefined") return null;
    const textarea = card.querySelector(".code-editor");
    if (!textarea) return null;

    const holder = document.createElement("div");
    holder.className = "tc-embed";
    textarea.parentNode.replaceChild(holder, textarea);

    const fileName = qFileName(q);
    const ide = TurboIDE.mount(holder, {
      code: q.starter,
      fileName: fileName,
      embedded: true,
      rows: 21,
      maxFontSize: 18,
      runner: TurboIDE.wandboxRunner({
        url: CONFIG.WANDBOX_URL,
        compiler: CONFIG.WANDBOX_COMPILER,
        timeout: CONFIG.RUN_TIMEOUT_MS
      }),
      onChange: (code) => { state.coding[q.id].code = code; },
      // Ctrl+F9 inside the IDE runs the marked test cases, not just the program
      onRunCheck: () => { runCodingQuestion(q, card); }
    });

    const hint = document.createElement("p");
    hint.className = "tc-hint";
    hint.innerHTML =
      "Turbo C++ 3.0 editor &mdash; click the blue screen first, then " +
      "<kbd>F10</kbd> menu, <kbd>Alt+F9</kbd> compile, <kbd>Ctrl+F9</kbd> run &amp; check, " +
      "<kbd>F6</kbd> message window, <kbd>Alt+F5</kbd> user screen. " +
      "<code>&lt;iostream.h&gt;</code> and <code>void main()</code> are accepted.";
    holder.parentNode.insertBefore(hint, holder.nextSibling);

    card.__ide = ide;
    return ide;
  }

  /** Mirror a run into the IDE's Message window and user screen. */
  function reportToIde(card, q, compileError, results) {
    const ide = card.__ide;
    if (!ide) return;
    const file = qFileName(q);
    if (compileError) {
      ide.showMessages(
        [{ kind: "info", text: "Compiling " + file + ":" }]
          .concat(TurboIDE.borlandize(compileError, file)),
        { focus: true });
      return;
    }
    const lines = [{ kind: "info", text: "Running " + file.replace(/\.CPP$/, ".EXE") + " against the test cases:" }];
    results.forEach((r, i) => {
      lines.push({
        kind: r.pass ? "info" : "error",
        text: "  Test " + (i + 1) + ": " + (r.pass ? "PASS" : "FAIL") +
              (r.pass ? "" : "  expected " + JSON.stringify(r.expected) +
                             ", got " + JSON.stringify(String(r.actual).trim()))
      });
    });
    const passed = results.filter((r) => r.pass).length;
    lines.push({ kind: passed === results.length ? "info" : "warning",
                 text: "  " + passed + " of " + results.length + " test cases passed." });
    ide.showMessages(lines, { focus: false });
    // keep the program output on the user screen (Alt+F5) without
    // yanking the student out of the editor
    if (results.length) {
      ide.setUserScreen(String(results[0].actual || "").replace(/\r/g, "").split("\n"));
    }
  }

  async function runCodingQuestion(q, card) {
    const st = state.coding[q.id];
    const runBtn = card.querySelector(".run-btn");
    const status = card.querySelector(".run-status");
    const testsSlot = card.querySelector(".tests-slot");

    runBtn.disabled = true;
    status.textContent = "Compiling and running your code…";
    testsSlot.innerHTML = "";
    card.querySelector(".feedback-slot").innerHTML = "";

    try {
      const results = [];
      let compileError = null;

      for (const t of q.tests) {
        const r = await executeCpp(st.code, t.stdin);
        if (r.compileError) { compileError = r.compileError; break; }
        results.push({
          stdin: t.stdin,
          expected: t.expected,
          actual: r.output,
          runtimeError: r.runtimeError,
          pass: !r.runtimeError && outputsMatch(r.output, t.expected)
        });
      }

      st.runs += 1;

      reportToIde(card, q, compileError, results);

      if (compileError) {
        st.lastResult = { passed: 0, total: q.tests.length, feedback: ["Code does not compile."] };
        showFeedback(card, "bad",
          "✘ Compilation error — your code does not compile. Fix the error below and run again:\n\n" +
          compileError.split("\n").slice(0, 12).join("\n"));
      } else {
        const passed = results.filter((r) => r.pass).length;
        const fbLines = buildCodingFeedback(q, st.code, results);
        st.lastResult = { passed, total: q.tests.length, feedback: fbLines };

        const kind = passed === q.tests.length ? "good" : passed > 0 ? "info" : "bad";
        const head =
          passed === q.tests.length
            ? `✔ Excellent! All ${passed}/${q.tests.length} test cases passed.`
            : `${passed}/${q.tests.length} test cases passed. Read the feedback below, improve your code and run again.`;
        showFeedback(card, kind, head + (fbLines.length ? "\n\n• " + fbLines.join("\n• ") : ""));
        testsSlot.innerHTML = renderTestTable(results);
      }
      status.textContent = `Attempt #${st.runs} completed.`;
      updateProgress();
    } catch (err) {
      status.textContent = "";
      showFeedback(card, "bad",
        "Could not reach the code-execution service. Check your internet connection and try again.\n(" +
        err.message + ")");
    } finally {
      runBtn.disabled = false;
    }
  }

  function buildCodingFeedback(q, code, results) {
    const fb = [];
    // static hints: fire when a required pattern is missing from the
    // code, or (fireWhen: "present") when a known bug is still there
    (q.hints || []).forEach((h) => {
      const found = h.pattern.test(code);
      if (h.fireWhen === "present" ? found : !found) fb.push(h.message);
    });
    results.forEach((r, i) => {
      if (r.runtimeError) {
        fb.push(`Test ${i + 1}: your program crashed or timed out (input: ${JSON.stringify(r.stdin)}).`);
      } else if (!r.pass) {
        // Common beginner mistake: correct answer buried in extra text
        // like input prompts ("Enter a number: ...").
        const squash = (t) => String(t).replace(/\s+/g, " ").trim();
        if (squash(r.expected) && squash(r.actual).includes(squash(r.expected))) {
          fb.push(`Test ${i + 1}: your ANSWER is correct, but your program prints extra text — it printed ${JSON.stringify(r.actual.trim())} while the checker expects EXACTLY ${JSON.stringify(r.expected)}. Remove prompts/labels like "Enter a number" or "The output is" and print only the required output.`);
        } else {
          fb.push(`Test ${i + 1}: for input ${JSON.stringify(r.stdin)} your program printed ${JSON.stringify(r.actual.trim())} but the expected output is ${JSON.stringify(r.expected)}.`);
        }
      }
    });
    if (fb.length === 0 && results.every((r) => r.pass)) {
      fb.push("Your solution is correct and handles all the tested inputs. Well done!");
    }
    return fb;
  }

  function renderTestTable(results) {
    const rows = results.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><pre>${escapeHtml(r.stdin)}</pre></td>
        <td><pre>${escapeHtml(r.expected)}</pre></td>
        <td><pre>${escapeHtml(r.runtimeError ? "(runtime error)" : r.actual.trim())}</pre></td>
        <td class="${r.pass ? "pass" : "fail"}">${r.pass ? "PASS" : "FAIL"}</td>
      </tr>`).join("");
    return `
      <table class="testcase-table">
        <thead><tr><th>#</th><th>Input</th><th>Expected Output</th><th>Your Output</th><th>Result</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  /** Compile + run C++ via the Wandbox API. */
  async function executeCpp(code, stdin) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.RUN_TIMEOUT_MS);
    try {
      const res = await fetch(CONFIG.WANDBOX_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          compiler: CONFIG.WANDBOX_COMPILER,
          // <iostream.h> / void main() / conio.h are rewritten for a modern
          // compiler without changing any line numbers
          code: (typeof TurboIDE !== "undefined") ? TurboIDE.modernize(code) : code,
          stdin: stdin
        })
      });
      if (!res.ok) throw new Error("Execution service returned HTTP " + res.status);
      const data = await res.json();

      // Wandbox puts warnings AND errors in compiler_error; only treat
      // it as a compile failure when an actual "error:" is present.
      if (data.compiler_error && /(^|\n)[^\n]*error[: ]/i.test(data.compiler_error)) {
        return { compileError: data.compiler_error };
      }
      return {
        output: data.program_output || "",
        runtimeError: String(data.status) !== "0" || data.signal
          ? (data.program_error || "runtime error (exit code " + data.status + ")")
          : null
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // ============================================================
  // GRADING + SUBMISSION
  // ============================================================
  function computeScores() {
    const perQuestion = [];
    let total = 0, maxTotal = 0;

    THEORY_QUESTIONS.forEach((q) => {
      const st = state.theory[q.id];
      const score = st && st.correct ? q.marks : 0;
      total += score; maxTotal += q.marks;
      perQuestion.push({
        id: q.id, type: "theory", title: q.text.replace(/`/g, "").slice(0, 60),
        score, max: q.marks,
        answered: !!(st && st.checked),
        note: !st || !st.checked ? "Not attempted"
          : st.correct ? "Correct" : "Incorrect"
      });
    });

    CODING_QUESTIONS.forEach((q) => {
      const st = state.coding[q.id];
      const r = st && st.lastResult;
      const score = r ? Math.round((r.passed / r.total) * q.marks * 10) / 10 : 0;
      total += score; maxTotal += q.marks;
      perQuestion.push({
        id: q.id, type: "coding", title: q.title,
        score, max: q.marks,
        answered: !!r,
        note: !r ? "Not attempted"
          : `${r.passed}/${r.total} test cases passed (${st.runs} run${st.runs > 1 ? "s" : ""})`,
        feedback: r ? r.feedback : ["Question was not attempted."]
      });
    });

    return { perQuestion, total: Math.round(total * 10) / 10, maxTotal };
  }

  $("#submit-btn").addEventListener("click", async () => {
    if (state.submitted) return;

    const unattempted =
      THEORY_QUESTIONS.filter((q) => !state.theory[q.id].checked).length +
      CODING_QUESTIONS.filter((q) => !state.coding[q.id].lastResult).length;
    if (unattempted > 0 &&
        !confirm(`You have ${unattempted} unattempted question(s). Submit anyway?`)) {
      return;
    }

    state.submitted = true;
    const btn = $("#submit-btn");
    const statusEl = $("#submit-status");
    btn.disabled = true;
    statusEl.textContent = "Recording your marks…";
    statusEl.classList.remove("error");

    const scores = computeScores();
    const recorded = await recordToSheet(scores);
    showResults(scores, recorded);
  });

  async function recordToSheet(scores) {
    if (!CONFIG.SHEETS_WEBAPP_URL) {
      return { ok: false, reason: "Recording is not configured (no spreadsheet URL set)." };
    }
    const payload = {
      assessment: CONFIG.ASSESSMENT_NAME,
      timestamp: new Date().toISOString(),
      startedAt: state.startedAt ? state.startedAt.toISOString() : "",
      name: state.student.name,
      studentId: state.student.id,
      class: state.student.klass,
      total: scores.total,
      maxTotal: scores.maxTotal,
      percent: Math.round((scores.total / scores.maxTotal) * 1000) / 10,
      questions: scores.perQuestion.map((q) => ({
        id: q.id, score: q.score, max: q.max, note: q.note
      }))
    };
    try {
      // text/plain avoids a CORS preflight, which Apps Script does not support.
      await fetch(CONFIG.SHEETS_WEBAPP_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: "Network error while recording: " + err.message };
    }
  }

  // ============================================================
  // RESULT SCREEN
  // ============================================================
  function showResults(scores, recorded) {
    $("#quiz-screen").classList.add("hidden");
    $("#result-screen").classList.remove("hidden");
    window.scrollTo(0, 0);

    const pct = Math.round((scores.total / scores.maxTotal) * 100);
    $("#score-summary").innerHTML = `
      <div class="score-big">${scores.total} / ${scores.maxTotal}</div>
      <p class="score-line">${pct}% — ${state.student.name} (${state.student.id})</p>
    `;

    $("#feedback-summary").innerHTML = scores.perQuestion.map((q) => {
      const cls = q.score >= q.max ? "good" : q.score > 0 ? "partial" : "bad";
      const fb = (q.feedback || []).map((f) => `<p>• ${fmt(f)}</p>`).join("");
      return `
        <div class="fb-item ${cls}">
          <h4>${q.id} — ${escapeHtml(q.title)} &nbsp; (${q.score}/${q.max})</h4>
          <p>${escapeHtml(q.note)}</p>
          ${fb}
        </div>`;
    }).join("");

    const rec = $("#record-status");
    if (recorded.ok) {
      rec.textContent = "✔ Your marks have been recorded in the class spreadsheet.";
    } else {
      rec.textContent = "⚠ Marks were NOT recorded automatically (" + recorded.reason +
        "). Please show this screen to your lecturer or take a screenshot.";
    }
  }
})();
