import { describe, expect, it } from "vitest";
import { KEY_ROWS, matchKey, type KeyEventLike } from "./keymap";

function press(key: string, mods: Partial<KeyEventLike> = {}): KeyEventLike {
  return { key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods };
}

const free = { inField: false, helpOpen: false };
const typing = { inField: true, helpOpen: false };

describe("grading keyboard map", () => {
  it("maps the documented keys", () => {
    expect(matchKey(press("["), free)).toEqual({ kind: "prevQuestion" });
    expect(matchKey(press("]"), free)).toEqual({ kind: "nextQuestion" });
    expect(matchKey(press("k"), free)).toEqual({ kind: "prevPaper" });
    expect(matchKey(press("j"), free)).toEqual({ kind: "nextPaper" });
    expect(matchKey(press("h"), free)).toEqual({ kind: "hideMarks" });
    expect(matchKey(press("?"), free)).toEqual({ kind: "help" });
  });

  it("maps 1 to 9 to criterion indexes", () => {
    expect(matchKey(press("1"), free)).toEqual({ kind: "criterion", index: 0 });
    expect(matchKey(press("9"), free)).toEqual({ kind: "criterion", index: 8 });
    expect(matchKey(press("0"), free)).toBeNull();
  });

  it("saves on the modifier and Enter, in a field or out of it", () => {
    expect(matchKey(press("Enter", { metaKey: true }), free)).toEqual({ kind: "save" });
    expect(matchKey(press("Enter", { ctrlKey: true }), typing)).toEqual({ kind: "save" });
  });

  it("Enter alone in the reason field does not submit", () => {
    expect(matchKey(press("Enter"), typing)).toBeNull();
    expect(matchKey(press("Enter"), free)).toBeNull();
  });

  it("leaves typed characters alone inside a field", () => {
    for (const key of ["1", "[", "]", "j", "k", "h", "?"]) expect(matchKey(press(key), typing)).toBeNull();
  });

  it("Escape closes the help popover and is otherwise the dialog's business", () => {
    expect(matchKey(press("Escape"), { inField: false, helpOpen: true })).toEqual({ kind: "closeHelp" });
    expect(matchKey(press("Escape"), free)).toBeNull();
  });

  it("ignores other modifier combinations so browser shortcuts survive", () => {
    expect(matchKey(press("j", { metaKey: true }), free)).toBeNull();
    expect(matchKey(press("h", { altKey: true }), free)).toBeNull();
  });

  it("documents every command it handles", () => {
    expect(KEY_ROWS).toHaveLength(8);
    expect(KEY_ROWS.map((row) => row.label)).toContain("Save and next");
  });
});
