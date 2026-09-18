/**
 * Every successful response uses the same envelope (spec §59):
 * { success: true, message, data }
 */
export function sendSuccess(res, { statusCode = 200, message = 'Success', data = null, meta } = {}) {
  const payload = { success: true, message, data };
  if (meta) payload.meta = meta;
  return res.status(statusCode).json(payload);
}

export function sendCreated(res, { message = 'Created successfully', data = null } = {}) {
  return sendSuccess(res, { statusCode: 201, message, data });
}
