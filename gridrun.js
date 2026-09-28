// gridrun.js：按共用处理预算处理事件，用尽则连着压账，收尾把账做完
import { rowOk, colOf } from "./grid.js";

function errorCodes(spec) {
  return {
    row: spec.bad_row_code || "E_BAD_ROW",
    index: spec.bad_index_code || "E_BAD_INDEX",
    event: spec.event_error_code || "E_BAD_EVENT"
  };
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

// 账上压的是三元组 [kind, values, index]，处理前还原成事件形状。
function normalize(item) {
  if (Array.isArray(item)) {
    return { kind: item[0], values: item[1] === null ? undefined : item[1], index: item[2] };
  }
  return item;
}

function toTriple(event) {
  return [
    event.kind,
    event.kind === "row" ? event.values.slice() : null,
    event.kind === "col" ? event.index : null
  ];
}

// 账上的三元组不带 id，按事件形状（kind/values/index）去重，重放才不会新增。
function eventKey(event) {
  return event.kind + "|" + JSON.stringify(event.kind === "row" ? event.values : null)
    + "|" + String(event.kind === "col" ? event.index : "");
}

function validate(event, cols, codes) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    fail(codes.event, "事件不合法");
  }
  if (event.kind === "row") {
    if (!rowOk(event.values, cols)) fail(codes.row, "行长度不对或值不是整数");
  } else if (event.kind === "col") {
    if (!Number.isInteger(event.index) || event.index < 0 || event.index >= cols) {
      fail(codes.index, "列号越界");
    }
  } else {
    fail(codes.event, "事件不合法");
  }
}

function applyTo(event, state) {
  if (event.kind === "row") {
    state.rows.push(event.values.slice());
  } else {
    state.gets.push([event.index, colOf(state.rows, event.index)]);
  }
}

function cloneState(source) {
  const src = source || {};
  return {
    rows: (src.rows || []).map(function (row) { return row.slice(); }),
    gets: (src.gets || []).map(function (entry) {
      return [entry[0], (entry[1] || []).slice()];
    }),
    ledger: (src.ledger || []).map(function (entry) {
      return [entry[0], entry[1] === null || entry[1] === undefined ? null : entry[1].slice(), entry[2]];
    }),
    applied: (src.applied || []).slice()
  };
}

// 先还旧账，再处理新事件；每条事件花一次预算，用尽后没处理的连着压账。
function run(spec, cap) {
  const codes = errorCodes(spec);
  const cols = spec.cols;
  const state = cloneState(spec.state);
  const queue = state.ledger.map(normalize).concat(spec.events || []);
  const judgedBound = queue.length;

  let served = 0;
  let judged = 0;
  const deferred = [];

  for (const raw of queue) {
    const event = normalize(raw);
    validate(event, cols, codes);
    judged += 1;
    if (state.applied.indexOf(eventKey(event)) !== -1) continue;
    if (served < cap) {
      applyTo(event, state);
      state.applied.push(eventKey(event));
      served += 1;
    } else {
      deferred.push(event);
    }
  }

  state.ledger = deferred.map(toTriple);
  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger,
    judged: judged,
    judged_bound: judgedBound
  };
}

export function step(spec) {
  const raw = Number(spec.budget);
  const cap = Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
  return run(spec, cap);
}

export function close(spec) {
  // 收尾不受预算限制，把账上压着的事件全部做完。
  const result = run(Object.assign({}, spec, { events: [] }), Number.POSITIVE_INFINITY);
  return { state: result.state, catchup: result.served };
}
