import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

export async function loadUser(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, subscription_tier, subscription_expires_at, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows[0]) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    req.currentUser = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

export function isPremium(user) {
  if (user.subscription_tier !== 'premium') return false;
  if (!user.subscription_expires_at) return true;
  return new Date(user.subscription_expires_at) > new Date();
}

export function requirePremium(req, res, next) {
  if (!isPremium(req.currentUser)) {
    return res.status(403).json({
      error: 'Эта функция доступна только с Premium-подпиской',
      code: 'PREMIUM_REQUIRED',
    });
  }
  next();
}

export async function canAccessPet(userId, petId) {
  const { rows } = await pool.query(
    `SELECT p.*, pm.role
     FROM pets p
     LEFT JOIN pet_members pm ON pm.pet_id = p.id AND pm.user_id = $1
     WHERE p.id = $2 AND (p.owner_id = $1 OR pm.user_id = $1)`,
    [userId, petId]
  );
  return rows[0] || null;
}

export async function getFamilyMemberCount(petId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM pet_members WHERE pet_id = $1',
    [petId]
  );
  return rows[0].count;
}
