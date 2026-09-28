// gridrun.js：按共用处理预算处理事件，用尽则连着压账，收尾清账
import { rowOk, colOf } from "./grid.js";

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function cloneState(source) {
  const state = source || {};
  return {
    rows: (state.rows || []).map(function (row) { return row.slice(); }),
    gets: (state.gets || []).map(function (entry) { return [entry[0], entry[1].slice()]; }),
    ledger: (state.ledger || []).map(function (entry) {
      return [entry[0], Array.isArray(entry[1]) ? entry[1].slice() : entry[1], entry[2]];
    }),
    applied: (state.applied || []).slice()
  };
}

function codesOf(spec) {
  return {
    row: spec.bad_row_code || "E_BAD_ROW",
    index: spec.bad_index_code || "E_BAD_INDEX",
    event: spec.event_error_code || "E_BAD_EVENT"
  };
}

// 先校验：事件结构 -> 行内容 -> 列号，任一不合法立即抛错
function validate(event, cols, codes) {
  if (!event || typeof event !== "object" || Array.isArray(event)) fail(codes.event);
  if (event.kind === "row") {
    if (!rowOk(event.values, cols)) fail(codes.row);
  } else if (event.kind === "col") {
    if (!Number.isInteger(event.index) || event.index < 0 || event.index >= cols) fail(codes.index);
  } else {
    fail(codes.event);
  }
}

function toEntry(event) {
  return event.kind === "row"
    ? ["row", event.values, null]
    : ["col", null, event.index];
}

function applyEntry(state, entry) {
  if (entry[0] === "row") {
    state.rows.push(entry[1].slice());
  } else {
    state.gets.push([entry[2], colOf(state.rows, entry[2])]);
  }
}

function applyEvent(state, event) {
  if (event.kind === "row") {
    state.rows.push(event.values.slice());
  } else {
    state.gets.push([event.index, colOf(state.rows, event.index)]);
  }
}

export function step(spec) {
  const state = cloneState(spec.state);
  const events = spec.events || [];
  const cols = spec.cols;
  const codes = codesOf(spec);
  let remaining = Number.isInteger(spec.budget) ? spec.budget : 0;
  let served = 0;

  // 先把上期压在账上的请求按 FIFO 用本档预算补齐
  while (remaining > 0 && state.ledger.length > 0) {
    applyEntry(state, state.ledger.shift());
    remaining -= 1;
    served += 1;
  }

  for (const event of events) {
    // 重放幂等：已记账（处理或压账）的事件不再处理
    if (event && typeof event === "object" && !Array.isArray(event)
        && event.id !== undefined && state.applied.indexOf(event.id) !== -1) {
      continue;
    }
    validate(event, cols, codes);
    if (remaining > 0) {
      applyEvent(state, event);
      remaining -= 1;
      served += 1;
    } else {
      // 预算用尽：后面的事件连着载压账
      state.ledger.push(toEntry(event));
    }
    if (event.id !== undefined) state.applied.push(event.id);
  }

  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger,
    judged: served,
    judged_bound: events.length
  };
}

export function close(spec) {
  const state = cloneState(spec.state);
  let catchup = 0;
  while (state.ledger.length > 0) {
    applyEntry(state, state.ledger.shift());
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
