class AppError extends Error {
  constructor(status, title, { type, detail, errors } = {}) {
    super(title);
    this.name = 'AppError';
    this.status = status;
    this.type = type || `https://mesa-ayuda.local/problems/${status}`;
    this.detail = detail;
    this.errors = errors;
  }
}

module.exports = { AppError };
