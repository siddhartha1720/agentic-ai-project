
const OPERATORS = ["eq", "neq", "gt", "gte", "lt", "lte"];

export function evaluateCondition(config, context) {
  const { field, operator, value } = config ?? {};

  if (typeof field !== "string" || !field.trim()) {
    throw new Error("Condition field is required.");
  }

  if (!OPERATORS.includes(operator)) {
    throw new Error(`Unsupported condition operator: ${operator}`);
  }

  // Read fields safely from structured data.
  const actual = field.split(".").reduce((obj, key) => {
    if (
      obj === null ||
      typeof obj !== "object" ||
      !Object.prototype.hasOwnProperty.call(obj, key)
    ) {
      return undefined;
    }
    return obj[key];
  }, context);

  if (actual === undefined) {
    throw new Error(`Condition field not found: ${field}`);
  }

  switch (operator) {
    case "eq":
      return actual === value;
    case "neq":
      return actual !== value;
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      if (
        typeof actual !== "number" ||
        typeof value !== "number" ||
        !Number.isFinite(actual) ||
        !Number.isFinite(value)
      ) {
        throw new Error("Comparison requires finite numeric values.");
      }
      if (operator === "gt") return actual > value;
      if (operator === "gte") return actual >= value;
      if (operator === "lt") return actual < value;
      return actual <= value;
  }
}
