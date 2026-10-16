// body, when given, is merged into the JSON error response.
function httpError(status, message, body) {
  return Object.assign(new Error(message), { status, body });
}

module.exports = { httpError };
