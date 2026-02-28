import type {
  DataCtx,
  JSONSchema,
  ValidationCtx,
  ValidationError,
  Validator,
} from "../index.js";

export const _undefined: Validator = function _undefined(
  input: unknown,
  schema: JSONSchema,
  _ctx: ValidationCtx,
  errors: ValidationError[],
  instancePath: string,
  _dataCtx: DataCtx | undefined,
  schemaPath: string,
) {
  if (input !== undefined) {
    errors.push({
      instancePath,
      schemaPath,
      message: "Expected undefined",
      data: input,
      schema,
    });
    return false;
  }

  return true;
};
