function sanitizeReleaseNotes(value) { return String(value || '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, 12000); }
module.exports = { sanitizeReleaseNotes };
