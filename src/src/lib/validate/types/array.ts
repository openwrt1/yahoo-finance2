import validateAndCoerce from "../index.js";
import type {
  DataCtx,
  JSONSchema,
  ValidationCtx,
  ValidationError,
  Validator,
} from "../index.js";

export const array: Validator = function array(
  input: unknown,
  schema: JSONSchema,
  ctx: ValidationCtx,
  errors: ValidationError[],
  instancePath: string,
  _dataCtx: DataCtx | undefined,
  schemaPath: string,
) {
  if (!Array.isArray(input)) {
    errors.push({ instancePath, message: "Expected an array", data: input });
    return false;
  }

  if (schema.items) {
    const dataCtx = { parentData: input, parentDataProperty: 0 };
    for (const [idx, value] of input.entries()) {
      dataCtx.parentDataProperty = idx;
      validateAndCoerce(
        value,
        schema.items as JSONSchema,
        ctx,
        errors,
        instancePath + "/" + idx,
        dataCtx,
        schemaPath + "/items",
      );
    }
  }

  return true;
};
