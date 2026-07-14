const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');

const ALLOWED_ROLES = ['owner', 'manager', 'doctor', 'therapist', 'accountant', 'receptionist', 'staff'];
const ALLOWED_LEDGER_MODES = ['actual', 'regular'];

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

async function list(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      where: { clinicId: req.user.clinicId },
      select: { id: true, name: true, username: true, email: true, role: true, ledgerMode: true, isActive: true, lastLogin: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, username: rawUsername, email, password, role, ledgerMode } = req.body;
    if (!name || !rawUsername || !email || !password || !role) {
      return res.status(400).json({ error: 'name, username, email, password, and role are required' });
    }
    let username;
    try { username = validateUsername(rawUsername); } catch (err) { return res.status(400).json({ error: err.message }); }
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const mode = ledgerMode && ALLOWED_LEDGER_MODES.includes(ledgerMode) ? ledgerMode : 'actual';
    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) return res.status(409).json({ error: 'Username already registered' });
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        clinicId: req.user.clinicId,
        name,
        username,
        email: normalizedEmail,
        password: hash,
        role,
        ledgerMode: mode,
      },
      select: { id: true, name: true, username: true, email: true, role: true, ledgerMode: true, isActive: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { name, username: rawUsername, email, role, isActive, ledgerMode } = req.body;
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, clinicId: req.user.clinicId },
    });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const data = {};
    if (name !== undefined) data.name = name;
    if (rawUsername !== undefined) {
      try { data.username = validateUsername(rawUsername); } catch (err) { return res.status(400).json({ error: err.message }); }
    }
    if (email !== undefined) data.email = String(email).trim().toLowerCase();
    if (role !== undefined) {
      if (!ALLOWED_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
      data.role = role;
    }
    if (isActive !== undefined) data.isActive = !!isActive;
    if (ledgerMode !== undefined) {
      if (!ALLOWED_LEDGER_MODES.includes(ledgerMode)) return res.status(400).json({ error: 'Invalid ledgerMode' });
      data.ledgerMode = ledgerMode;
    }

    if (data.username && data.username !== existing.username) {
      const dup = await prisma.user.findUnique({ where: { username: data.username } });
      if (dup) return res.status(409).json({ error: 'Username already in use' });
    }

    if (data.email && data.email !== existing.email) {
      const dup = await prisma.user.findUnique({ where: { email: data.email } });
      if (dup) return res.status(409).json({ error: 'Email already in use' });
    }

    const user = await prisma.user.update({
      where: { id: existing.id },
      data,
      select: { id: true, name: true, username: true, email: true, role: true, ledgerMode: true, isActive: true },
    });
    res.json(user);
  } catch (err) { next(err); }
}

async function resetPassword(req, res, next) {
  try {
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 10) {
      return res.status(400).json({ error: 'newPassword must be at least 10 characters' });
    }
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, clinicId: req.user.clinicId },
    });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: existing.id }, data: { password: hash } });
    await prisma.refreshToken.deleteMany({ where: { userId: existing.id } });
    res.json({ message: 'Password reset' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, clinicId: req.user.clinicId },
    });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    await prisma.refreshToken.deleteMany({ where: { userId: existing.id } });
    await prisma.user.update({ where: { id: existing.id }, data: { isActive: false } });
    res.json({ message: 'User deactivated' });
  } catch (err) { next(err); }
}

module.exports = { list, create, update, resetPassword, remove };
