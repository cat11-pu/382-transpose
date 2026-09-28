// grid.js：行合法性与按列读取（原生实现，零依赖）
export function rowOk(values, cols) {
  return Array.isArray(values) && values.length === cols
    && values.every(function (value) { return Number.isInteger(value); });
}

export function colOf(rows, index) {
  return rows.map(function (row) { return row[index]; });
}
