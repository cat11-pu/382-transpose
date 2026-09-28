import assert from "node:assert";
import { rowOk, colOf } from "../grid.js";
import { step, close } from "../gridrun.js";
import { render } from "../app.js";

const base = {
  budget: 1, cols: 3,
  state: { rows: [], gets: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "row", values: [1, 2, 3] }],
  bad_row_code: "E_BAD_ROW", bad_index_code: "E_BAD_INDEX",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("rowOk returns a boolean", () => {
  assert.strictEqual(typeof rowOk([1, 2], 2), "boolean");
});

check("colOf returns a list", () => {
  assert.ok(Array.isArray(colOf([[1, 2]], 1)));
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
