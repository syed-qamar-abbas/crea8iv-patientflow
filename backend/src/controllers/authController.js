const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const prisma = require('../utils/prisma');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');

function normalizeUsername(value) {
  return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}

function validateUsername(value) {
  const username = normalizeUsername(value);
  if (!username) throw new Error('Username is required');
  if (username.length < 3 || username.length > 32) throw new Error('Username must be 3 to 32 characters');
  if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(username)) {
    throw new Error('Username can use letters, numbers, dots, hyphens, and underscores, and must start and end with a letter or number');
  }
  return username;
}

async function register(req, res, next) {
  try {
    const { clinicName, name, username: rawUsername, email, password } = req.body;
    if (!clinicName || !name || !rawUsername || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    let username;
    try { username = validateUsername(rawUsername); } catch (err) { return res.status(400).json({ error: err.message }); }
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) return res.status(409).json({ error: 'Username already registered' });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const clinic = await prisma.clinic.create({ data: { name: clinicName } });
    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { clinicId: clinic.id, name, username, email, password: hash, role: 'owner' },
    });

    const accessToken = signAccess({ id: user.id, clinicId: clinic.id, role: user.role, name: user.name });
    const refreshToken = signRefresh({ id: user.id });
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    res.status(201).json({ accessToken, refreshToken, user: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role, ledgerMode: user.ledgerMode || 'actual', clinicId: clinic.id } });
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const { password } = req.body;
    const identifier = normalizeUsername(req.body.username || req.body.identifier || req.body.email);
    const user = await prisma.user.findFirst({ where: { OR: [{ username: identifier }, { email: identifier }] } });
    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    const accessToken = signAccess({ id: user.id, clinicId: user.clinicId, role: user.role, name: user.name });
    const refreshToken = signRefresh({ id: user.id });
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    res.json({ accessToken, refreshToken, user: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role, ledgerMode: user.ledgerMode || 'actual', clinicId: user.clinicId } });
  } catch (err) { next(err); }
}

async function usernameAvailability(req, res, next) {
  try {
    let username;
    try {
      username = validateUsername(req.query.username || req.body?.username);
    } catch (err) {
      return res.json({ available: false, valid: false, message: err.message });
    }
    const excludeUserId = req.query.excludeUserId || req.body?.excludeUserId;
    const existing = await prisma.user.findUnique({ where: { username } });
    res.json({ username, valid: true, available: !existing || existing.id === excludeUserId });
  } catch (err) { next(err); }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    let payload;
    try { payload = verifyRefresh(refreshToken); } catch { return res.status(401).json({ error: 'Invalid refresh token' }); }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) return res.status(401).json({ error: 'Refresh token expired' });

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || !user.isActive) return res.status(401).json({ error: 'User inactive' });

    const accessToken = signAccess({ id: user.id, clinicId: user.clinicId, role: user.role, name: user.name });
    res.json({ accessToken });
  } catch (err) { next(err); }
}

async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    res.json({ message: 'Logged out' });
  } catch (err) { next(err); }
}

async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, username: true, email: true, role: true, ledgerMode: true, clinicId: true, lastLogin: true, createdAt: true },
    });
    res.json(user);
  } catch (err) { next(err); }
}

module.exports = { register, login, usernameAvailability, refresh, logout, me };
