import { set } from "../index.js";
import type {
  DataCtx,
  JSONSchema,
  ValidationCtx,
  ValidationError,
  Validator,
} from "../index.js";

export const number: Validator = function number(
  input: unknown,
  schema: JSONSchema,
  _ctx: ValidationCtx,
  errors: ValidationError[],
  instancePath: string,
  dataCtx: DataCtx | undefined,
  schemaPath: string,
) {
  // YahooFinance types

  if (typeof input === "string") {
    const float = Number.parseFloat(input);
    if (Number.isNaN(float)) {
      errors.push({
        instancePath,
        schemaPath,
        keyword: "yahooFinanceType",
        message: "Number.parseFloat returned NaN",
        params: { schema },
        data: input,
      });
      return false;
    }
    set(dataCtx, float, instancePath);
    return true;
  }

  if (typeof input === "object" && input !== null) {
    if (Object.keys(input).length === 0) {
      // Value of {} becomes null
      // Note, TypeScript types should be "number | null"
      if (Array.isArray(schema.type) && schema.type.includes("null")) {
        set(dataCtx, null, instancePath);
        return true;
      } else {
        errors.push({
          instancePath,
          schemaPath,
          keyword: "yahooFinanceType",
          message: "Got {}->null for 'number', did you want 'number | null' ?",
          params: { schema },
          data: input,
        });
        return false;
      }
    }

    if ("raw" in input && typeof input.raw === "number") {
      set(dataCtx, input.raw, instancePath);
      return true;
    }
  }

  // Regular number validation follows

  if (typeof input !== "number") {
    errors.push({
      instancePath,
      schemaPath,
      message: "Expected a number'ish",
      data: input,
    });
    return false;
  }

  return true;
};
