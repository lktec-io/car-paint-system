const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  });
}

function generateRefreshToken() {
  // Raw opaque token — we store its hash in the DB
  return crypto.randomBytes(64).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

module.exports = { generateAccessToken, generateRefreshToken, hashToken, verifyAccessToken };
