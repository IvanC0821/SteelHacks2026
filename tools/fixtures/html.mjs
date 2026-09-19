/**
 * HTML builders for the fixture PDFs.
 *
 * Two looks. Student papers imitate a scan of handwritten work: ruled or plain stock, a pink
 * margin rule, a handwriting face, writing that sits on the ruling with a per-line wobble, and a
 * whole-sheet tilt. Staff documents (questions, solution) stay typed and clean so the contrast is
 * obvious in the reader.
 *
 * Constraints that shape the markup:
 *   - No raster images and no gradients. Chromium rasterizes gradients when printing, which
 *     pushed each PDF past 700 KB; flat fills and positioned rules keep them near 60 KB.
 *   - No text-shadow. It makes Chromium paint every run twice, which duplicates every word in
 *     pypdf's extracted text, and the backend anchors flags to that text.
 *   - Brackets are drawn with borders, not glyphs, so they span the whole matrix.
 */

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Deterministic PRNG so a rebuild produces identical bytes. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** Writing grid, in CSS px at 96 dpi (Letter = 816 x 1056). */
const SHEET = { inset: 15, top: 15, bottom: 15 };
const GRID = { pitch: 33, bodyTop: 70, left: 106, right: 54, rows: 29 };

export function fontFaces(fonts) {
  const face = (family, weight, b64) => `@font-face{font-family:"${family}";font-style:normal;
  font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format("woff2");}`;
  return [
    face("FxCaveat", 400, fonts.caveat400),
    face("FxCaveat", 600, fonts.caveat600),
    face("FxPatrick", 400, fonts.patrick400),
    face("FxSans", 400, fonts.sans400),
    face("FxSans", 600, fonts.sans600),
    face("FxSerif", 400, fonts.serif400),
  ].join("\n");
}

const PAGE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
@page{size:Letter;margin:0}
html,body{width:8.5in}
.page{position:relative;width:8.5in;height:11in;overflow:hidden;page-break-after:always}
.page:last-child{page-break-after:auto}
`;

/* ---------------------------------------------------------------- student papers */

const HAND_CSS = `
.page.scan{background:#dedbd3}
.sheet{position:absolute;top:${SHEET.top}px;left:${SHEET.inset}px;right:${SHEET.inset}px;
  bottom:${SHEET.bottom}px;background:#fdfcf7;border:1px solid #cfcabd;
  transform-origin:50% 50%;overflow:hidden}
.edge{position:absolute;background:#eae6da}
.rule{position:absolute;left:0;right:0;height:1px;background:#c3d4e6}
.margin{position:absolute;top:0;bottom:0;left:${GRID.left - 22}px;width:1.4px;background:#dfa3ac}
.punch{position:absolute;left:26px;width:15px;height:15px;border-radius:50%;background:#e9e5da;
  border:1px solid #d6d1c4}
.hdr{position:absolute;top:30px;left:${GRID.left}px;right:${GRID.right}px;
  font-family:"FxSans",sans-serif;font-size:8px;letter-spacing:.055em;text-transform:uppercase;
  color:#918979}
.hdr .u{margin-top:5px;height:1px;background:#cdc7b9}
.body{position:absolute;top:${GRID.bodyTop}px;left:${GRID.left}px;right:${GRID.right}px}
.ln{height:${GRID.pitch}px;display:flex;align-items:flex-end;padding-bottom:5px;
  white-space:nowrap}
.ln .tok{display:inline-block;white-space:pre}
.head .u{display:inline-block;border-bottom:1.4px solid currentColor;padding-bottom:1px}
/* No opacity here: a compositing layer makes Chromium emit per-glyph positions,
   and pypdf then extracts the struck line as "b a c k - s u b". */
.strike{position:relative}
.strike::after{content:"";position:absolute;left:-5px;right:-5px;top:52%;height:1.5px;
  background:currentColor;transform:rotate(-.8deg)}
.boxed{display:inline-block;padding:0 9px 2px;border:1.5px solid currentColor;
  border-radius:11px 9px 12px 8px/9px 12px 8px 11px}
.brk{width:8px;align-self:stretch;border:1.7px solid currentColor}
.brk.l{border-right:0;border-radius:7px 0 0 7px/14px 0 0 14px}
.brk.r{border-left:0;border-radius:0 7px 7px 0/0 14px 14px 0}
.mat{display:inline-flex;align-items:stretch;gap:5px}
.mat table{border-collapse:collapse}
.mat td{height:${GRID.pitch}px;vertical-align:bottom;padding:0 .32em 5px;text-align:right;
  min-width:1.1em}
.mat td.augsep{border-left:1.4px solid currentColor;padding-left:.5em}
.lead{display:flex;align-items:flex-end;padding:0 10px 5px 0;height:${GRID.pitch}px}
.ansbox{display:inline-flex;align-items:stretch;gap:7px;padding:0 10px 0 9px;
  border:1.5px solid currentColor;border-radius:12px 9px 13px 8px/9px 13px 8px 12px}
.ansbox .lbl{display:flex;align-items:center;padding-bottom:3px}
.stack{display:flex;flex-direction:column;text-align:center;min-width:1.2em}
.stack span{height:${GRID.pitch}px;display:flex;align-items:flex-end;justify-content:flex-end;
  padding-bottom:5px}
`;

/**
 * Split a line into per-word spans so each word can sit a hair above or below the baseline.
 * The separating space lives INSIDE the span (white-space:pre) rather than between spans: a
 * space between two inline-blocks is drawn as a position advance, which pypdf then extracts as
 * no space at all, and the page text would come back as "rrefhas2pivots".
 */
function tokens(text, r) {
  const words = String(text).split(" ");
  return words
    .map((w, i) => {
      const dy = (r() - 0.5) * 1.6;
      const body = esc(w) + (i === words.length - 1 ? "" : " ");
      return `<span class="tok" style="transform:translateY(${dy.toFixed(2)}px)">${body}</span>`;
    })
    .join("");
}

function handLine(block, r, hand) {
  const rot = (r() - 0.5) * 0.9;
  const dy = (r() - 0.5) * 2.4;
  let inner = tokens(block.text, r);
  if (block.t === "head") inner = `<span class="u">${inner}</span>`;
  if (block.strike) inner = `<span class="strike">${inner}</span>`;
  if (block.box) inner = `<span class="boxed">${inner}</span>`;
  const cls = block.t === "head" ? "ln head" : "ln";
  return `<div class="${cls}" style="transform:translateY(${dy.toFixed(2)}px) rotate(${rot.toFixed(
    2,
  )}deg)"><span>${inner}</span></div>`;
}

function handMatrix(block, r) {
  const body = block.rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell, i) => {
            const sep = block.aug && i === row.length - block.aug ? " augsep" : "";
            const dy = (r() - 0.5) * 1.8;
            return `<td class="c${sep}"><span style="display:inline-block;transform:translateY(${dy.toFixed(
              2,
            )}px)">${esc(cell)}</span></td>`;
          })
          .join("")}</tr>`,
    )
    .join("");
  const rot = (r() - 0.5) * 0.7;
  const lead = block.lead ? `<span class="lead">${esc(block.lead)}</span>` : "";
  const trail = block.trail
    ? `<span class="lead" style="align-self:center;padding:0 0 3px 11px">${esc(block.trail)}</span>`
    : "";
  return `<div style="display:flex;align-items:flex-start;transform:rotate(${rot.toFixed(2)}deg)">
  ${lead}<span class="mat"><span class="brk l"></span><table>${body}</table><span class="brk r"></span></span>${trail}
</div>`;
}

function handAnswer(block, r) {
  const rot = (r() - 0.5) * 0.6;
  let value;
  if (block.column) {
    const stack = block.column.map((v) => `<span>${esc(v)}</span>`).join("");
    value = `<span class="mat"><span class="brk l"></span><span class="stack">${stack}</span><span class="brk r"></span></span>`;
  } else {
    const body = block.grid
      .map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
      .join("");
    value = `<span class="mat"><span class="brk l"></span><table>${body}</table><span class="brk r"></span></span>`;
  }
  return `<div style="display:flex;transform:rotate(${rot.toFixed(2)}deg)">
  <span class="ansbox"><span class="lbl">${esc(block.label)}</span>${value}</span>
</div>`;
}

/**
 * @param {string} name   fictional student name
 * @param {object} hand   pen/paper settings from content.mjs HANDS
 * @param {Array}  pages  blocks per page from studentPages()
 */
export function studentHtml(name, hand, pages, fonts) {
  const family = hand.font === "caveat" ? '"FxCaveat"' : '"FxPatrick"';
  const r = rng(hand.seed * 7919);
  const sheetH = 1056 - SHEET.top - SHEET.bottom;
  const rules =
    hand.paper === "ruled"
      ? Array.from({ length: GRID.rows }, (_, i) => GRID.bodyTop + GRID.pitch * (i + 1))
          .filter((y) => y < sheetH - 24)
          .map((y) => `<div class="rule" style="top:${y}px"></div>`)
          .join("")
      : "";
  const punches =
    hand.paper === "ruled"
      ? [0.16, 0.5, 0.84]
          .map((f) => `<div class="punch" style="top:${Math.round(sheetH * f)}px"></div>`)
          .join("")
      : "";

  const sheets = pages
    .map((blocks, i) => {
      const parts = blocks.map((b) => {
        if (b.t === "gap") return `<div style="height:${GRID.pitch * (b.rows || 1)}px"></div>`;
        if (b.t === "matrix") return handMatrix(b, r);
        if (b.t === "answer") return handAnswer(b, r);
        return handLine(b, r, hand);
      });
      const tilt = hand.tilt + (r() - 0.5) * 0.28;
      return `<section class="page scan">
  <div class="sheet" style="transform:rotate(${tilt.toFixed(2)}deg)">
    ${rules}${punches}<div class="margin"></div>
    <div class="edge" style="left:0;top:0;bottom:0;width:7px"></div>
    <div class="edge" style="left:0;right:0;bottom:0;height:6px"></div>
    <div class="hdr">${esc(name)} &middot; Homework 1 &middot; page ${i + 1} of ${
      pages.length
    } (fictional)<div class="u"></div></div>
    <div class="body">${parts.join("\n")}</div>
  </div>
</section>`;
    })
    .join("\n");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(name)} - Homework 1</title>
<style>${fontFaces(fonts)}${PAGE_CSS}${HAND_CSS}
.body{font-family:${family},cursive;font-weight:${hand.weight};color:${hand.ink};
  font-size:${hand.size}px}
</style></head><body>${sheets}</body></html>`;
}

/* ------------------------------------------------------------------ staff papers */

const TYPED_CSS = `
.page.typed{background:#ffffff;padding:0.95in 1in}
.typed .brand{font-family:"FxSans",sans-serif;font-size:8.5px;letter-spacing:.14em;
  text-transform:uppercase;color:#6a6f7a}
.typed h1{font-family:"FxSerif",serif;font-size:25px;font-weight:400;letter-spacing:-.01em;
  color:#15181d;margin:7px 0 4px}
.typed .sub{font-family:"FxSans",sans-serif;font-size:10.5px;color:#6a6f7a}
.typed .divider{height:1px;background:#e2e4e8;margin:17px 0 19px}
.typed p,.typed li{font-family:"FxSerif",serif;font-size:12px;line-height:1.62;color:#22262d}
.typed .intro{color:#4a505a;margin-bottom:19px}
.typed .caption{font-family:"FxSans",sans-serif;font-size:9.5px;letter-spacing:.03em;
  text-transform:uppercase;color:#6a6f7a;margin-bottom:9px}
.typed .q{display:flex;gap:14px;margin-bottom:17px;break-inside:avoid}
.typed .num{font-family:"FxSans",sans-serif;font-size:10px;font-weight:600;color:#8a9099;
  min-width:1.15em;padding-top:2px}
.typed .qt{font-family:"FxSans",sans-serif;font-size:11px;font-weight:600;color:#15181d;
  margin-bottom:2px}
.typed .pts{font-family:"FxSans",sans-serif;font-size:9.5px;color:#8a9099;margin-left:auto;
  white-space:nowrap;padding-top:3px}
.typed .part{margin-bottom:17px;break-inside:avoid}
.typed .ph{font-family:"FxSans",sans-serif;font-size:11px;font-weight:600;color:#15181d;
  margin-bottom:6px}
.typed .note{font-family:"FxSans",sans-serif;font-size:10px;color:#6a6f7a;
  border-left:2px solid #e2e4e8;padding-left:10px;margin-top:8px}
.typed .tm{display:inline-flex;align-items:stretch;gap:6px;font-family:"FxSerif",serif;
  font-size:12px;color:#22262d;margin:9px 0}
.typed .tm .brk{width:6px;align-self:stretch;border:1px solid #9aa0a8}
.typed .tm .brk.l{border-right:0}
.typed .tm .brk.r{border-left:0}
.typed .tm table{border-collapse:collapse}
.typed .tm td{padding:2px 8px;text-align:right;min-width:1.3em}
.typed .tm td.augsep{border-left:1px solid #c6cad1;padding-left:12px}
.typed .ansline{display:flex;align-items:center;gap:9px;margin:9px 0 2px;
  font-family:"FxSerif",serif;font-size:12px;color:#15181d}
.typed .foot{position:absolute;left:1in;right:1in;bottom:0.62in;font-family:"FxSans",sans-serif;
  font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:#9aa0a8;
  border-top:1px solid #edeff2;padding-top:7px;display:flex;justify-content:space-between}
`;

function typedMatrix(rows, aug) {
  const body = rows
    .map(
      (row) =>
        `<tr>${row
          .map((c, i) => `<td${aug && i === row.length - aug ? ' class="augsep"' : ""}>${esc(c)}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<span class="tm"><span class="brk l"></span><table>${body}</table><span class="brk r"></span></span>`;
}

function typedAnswer(a) {
  const value = a.column ? typedMatrix(a.column.map((v) => [v]), 0) : typedMatrix(a.grid, 0);
  return `<div class="ansline"><span>${esc(a.label)}</span>${value}</div>`;
}

export function questionsHtml(sheet, systemMatrix, fonts) {
  const qs = sheet.questions
    .map(
      (q) => `<div class="q"><div class="num">${q.n}</div><div><div class="qt">${esc(
        q.title,
      )}</div><p>${esc(q.prompt)}</p></div><div class="pts">${q.points} pts</div></div>`,
    )
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Homework 1</title>
<style>${fontFaces(fonts)}${PAGE_CSS}${TYPED_CSS}</style></head><body>
<section class="page typed">
  <div class="brand">${esc(sheet.course)}</div>
  <h1>${esc(sheet.title)}</h1>
  <div class="sub">${esc(sheet.subtitle)}</div>
  <div class="divider"></div>
  <p class="intro">${esc(sheet.intro)}</p>
  <div class="caption">${esc(sheet.matrixCaption)}</div>
  ${typedMatrix(systemMatrix, 1)}
  <div class="divider"></div>
  ${qs}
  <div class="foot"><span>Homework 1 &middot; fictional coursework</span><span>Page 1 of 1</span></div>
</section></body></html>`;
}

export function solutionHtml(sheet, fonts) {
  const part = (p) => `<div class="part"><div class="ph">${esc(p.heading)}</div>
  ${p.lines.map((l) => `<p>${esc(l)}</p>`).join("")}
  ${p.answer ? typedAnswer(p.answer) : ""}
  ${p.note ? `<div class="note">${esc(p.note)}</div>` : ""}</div>`;
  const pageOf = (parts, n, total, withHead) => `<section class="page typed">
  ${
    withHead
      ? `<div class="brand">${esc(sheet.course)}</div><h1>${esc(sheet.title)}</h1>
  <div class="sub">${esc(sheet.subtitle)}</div><div class="divider"></div>`
      : `<div class="brand">${esc(sheet.title)} &middot; continued</div><div class="divider"></div>`
  }
  ${parts.map(part).join("\n")}
  <div class="foot"><span>Instructor solution &middot; staff only &middot; fictional</span><span>Page ${n} of ${total}</span></div>
</section>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Instructor solution</title>
<style>${fontFaces(fonts)}${PAGE_CSS}${TYPED_CSS}</style></head><body>
${pageOf(sheet.parts, 1, 1, true)}
</body></html>`;
}
