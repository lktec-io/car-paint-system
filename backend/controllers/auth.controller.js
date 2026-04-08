const pool = require('../config/db');
const { comparePassword } = require('../utils/hashPassword');
const { generateAccessToken, generateRefreshToken, hashToken } = require('../utils/generateToken');

const REFRESH_COOKIE = 'refresh_token';
// Cookie lives 7 days; DB record also expires at this point
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

function setCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_EXPIRES_MS,
    path: '/api/auth', // scope cookie to auth routes only
  };
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.query(
      `SELECT u.*, o.name AS org_name
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.email = ? LIMIT 1`,
      [email]
    );

    // Same error message for both "not found" and "wrong password" — prevents user enumeration
    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, error: 'Account is deactivated' });
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id,
      full_name: user.full_name,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken();
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);

    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, tokenHash, expiresAt]
    );

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    res.cookie(REFRESH_COOKIE, refreshToken, setCookieOptions());

    return res.json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          organization_id: user.organization_id,
          org_name: user.org_name,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No refresh token' });
    }

    const tokenHash = hashToken(token);

    const [rows] = await pool.query(
      `SELECT rt.id, u.id AS uid, u.email, u.role, u.organization_id,
              u.full_name, u.is_active
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = ? AND rt.expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (rows.length === 0) {
      res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
    }

    const record = rows[0];

    if (!record.is_active) {
      await pool.query('DELETE FROM refresh_tokens WHERE id = ?', [record.id]);
      res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      return res.status(401).json({ success: false, error: 'Account is deactivated' });
    }

    // Rotate refresh token — invalidate old one, issue new one
    await pool.query('DELETE FROM refresh_tokens WHERE id = ?', [record.id]);

    const newRefreshToken = generateRefreshToken();
    const newHash = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);

    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [record.uid, newHash, expiresAt]
    );

    const tokenPayload = {
      id: record.uid,
      email: record.email,
      role: record.role,
      organization_id: record.organization_id,
      full_name: record.full_name,
    };

    const accessToken = generateAccessToken(tokenPayload);

    res.cookie(REFRESH_COOKIE, newRefreshToken, setCookieOptions());

    return res.json({
      success: true,
      data: {
        accessToken,
        user: {
          id: record.uid,
          full_name: record.full_name,
          email: record.email,
          role: record.role,
          organization_id: record.organization_id,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const token = req.cookies[REFRESH_COOKIE];

    if (token) {
      const tokenHash = hashToken(token);
      // Best-effort delete — don't fail logout if token already gone
      await pool.query('DELETE FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
    }

    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refresh, logout };
