const prisma = require('../utils/prisma');
const bcrypt = require('bcryptjs');

async function list(req, res, next) {
  try {
    const { search, specialty, status, tier, page = 1, limit = 50 } = req.query;
    const where = { clinicId: req.user.clinicId };
    if (search) where.OR = [{ name: { contains: search } }, { phone: { contains: search } }, { email: { contains: search } }];
    if (specialty) where.specialty = { contains: specialty };
    if (status) where.status = status;
    if (tier) where.loyaltyTier = tier;

    const [clients, total] = await Promise.all([
      prisma.client.findMany({ where, skip: (page - 1) * limit, take: Number(limit), orderBy: { createdAt: 'desc' } }),
      prisma.client.count({ where }),
    ]);
    res.json({ clients, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const client = await prisma.client.findFirst({ where: { id: req.params.id, clinicId: req.user.clinicId } });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const data = { ...req.body };
    data.clinicId = req.user.clinicId;
    if (!data.patientNo) {
      const count = await prisma.client.count({ where: { clinicId: req.user.clinicId } });
      data.patientNo = `PT-${String(count + 1).padStart(4, '0')}`;
    }
    if (Array.isArray(data.specialty)) data.specialty = JSON.stringify(data.specialty);
    if (Array.isArray(data.medicalHistory)) data.medicalHistory = JSON.stringify(data.medicalHistory);
    if (data.profileData && typeof data.profileData === 'object') data.profileData = JSON.stringify(data.profileData);
    if (!data.initials && data.name) data.initials = data.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const client = await prisma.client.create({ data });
    res.locals.entityId = client.id;
    res.status(201).json(client);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const data = { ...req.body };
    if (Array.isArray(data.specialty)) data.specialty = JSON.stringify(data.specialty);
    if (Array.isArray(data.medicalHistory)) data.medicalHistory = JSON.stringify(data.medicalHistory);
    if (data.profileData && typeof data.profileData === 'object') data.profileData = JSON.stringify(data.profileData);
    delete data.clinicId;
    const client = await prisma.client.updateMany({ where: { id: req.params.id, clinicId: req.user.clinicId }, data });
    res.json(client);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await prisma.client.updateMany({ where: { id: req.params.id, clinicId: req.user.clinicId }, data: { status: 'inactive' } });
    res.json({ message: 'Client deactivated' });
  } catch (err) { next(err); }
}

async function getAppointments(req, res, next) {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { clientId: req.params.id, clinicId: req.user.clinicId },
      include: { staff: { select: { name: true, role: true } }, service: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });
    res.json(appointments);
  } catch (err) { next(err); }
}

async function getPackages(req, res, next) {
  try {
    const packages = await prisma.clientPackage.findMany({
      where: { clientId: req.params.id, client: { clinicId: req.user.clinicId } },
      include: { package: true },
    });
    res.json(packages);
  } catch (err) { next(err); }
}

async function generatePortalCredentials(req, res, next) {
  try {
    const { email, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    await prisma.client.updateMany({
      where: { id: req.params.id, clinicId: req.user.clinicId },
      data: { portalEmail: email, portalPasswordHash: hash },
    });
    res.json({ message: 'Portal credentials set' });
  } catch (err) { next(err); }
}

module.exports = { list, getById, create, update, remove, getAppointments, getPackages, generatePortalCredentials };
