function sendSuccess(res, data, message) {
  const payload = { ok: true, data: data ?? null };
  if (message) payload.message = message;
  return res.json(payload);
}

/**
 * Respons list dengan metadata pagination.
 * `meta` bernilai null untuk endpoint yang memang mengembalikan seluruh data.
 */
function sendPaginated(res, data, meta) {
  const payload = { ok: true, data: data ?? [] };
  if (meta) payload.meta = meta;
  return res.json(payload);
}

function sendError(res, statusCode, message, details) {
  const payload = { ok: false, message };
  if (details) payload.details = details;
  return res.status(statusCode).json(payload);
}

module.exports = {
  sendSuccess,
  sendPaginated,
  sendError,
};
