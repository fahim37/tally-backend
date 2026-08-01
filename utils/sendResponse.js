import { StatusCodes } from 'http-status-codes';

/**
 * The one response shape the API speaks, matching the starter's existing
 * `{ success, message, data }` envelope. `meta` carries pagination for the
 * History list without changing the shape.
 */
const sendResponse = (
  res,
  { statusCode = StatusCodes.OK, message = 'Success', data = null, meta = undefined }
) => {
  const body = { success: statusCode < 400, message, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(statusCode).json(body);
};

export default sendResponse;
