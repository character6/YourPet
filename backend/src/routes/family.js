import { Router } from 'express';
import pool from '../config/db.js';
import {
  authenticate,
  loadUser,
  requirePremium,
  canAccessPet,
  getFamilyMemberCount,
  isPremium,
} from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authenticate, loadUser, requirePremium);

const MAX_FAMILY_MEMBERS = 5;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function buildInviteLink(token) {
  return `${FRONTEND_URL}/invite/${token}`;
}

function buildReferralLink(referralToken) {
  return `${FRONTEND_URL}/invite/${referralToken}`;
}

async function ensureUserReferralToken(userId) {
  const { rows } = await pool.query(
    'SELECT family_referral_token FROM users WHERE id = $1',
    [userId]
  );
  if (rows[0]?.family_referral_token) {
    return rows[0].family_referral_token;
  }
  const { rows: updated } = await pool.query(
    'UPDATE users SET family_referral_token = gen_random_uuid() WHERE id = $1 RETURNING family_referral_token',
    [userId]
  );
  return updated[0].family_referral_token;
}

router.get('/referral-link', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet || pet.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Только владелец может получить реферальную ссылку' });
    }

    let token = pet.family_referral_token;
    if (!token) {
      const { rows } = await pool.query(
        'UPDATE pets SET family_referral_token = gen_random_uuid() WHERE id = $1 RETURNING family_referral_token',
        [req.params.petId]
      );
      token = rows[0].family_referral_token;
    }

    res.json({
      referralLink: buildReferralLink(token),
      token,
      petName: pet.name,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/referral-link/regenerate', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet || pet.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Только владелец может обновить ссылку' });
    }

    const { rows } = await pool.query(
      'UPDATE pets SET family_referral_token = gen_random_uuid() WHERE id = $1 RETURNING family_referral_token, name',
      [req.params.petId]
    );

    res.json({
      referralLink: buildReferralLink(rows[0].family_referral_token),
      token: rows[0].family_referral_token,
      petName: rows[0].name,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/members', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }

    const { rows } = await pool.query(
      `SELECT pm.user_id, pm.role, pm.joined_at, u.name, u.email
       FROM pet_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.pet_id = $1
       ORDER BY pm.joined_at ASC`,
      [req.params.petId]
    );

    res.json({
      members: rows.map((r) => ({
        userId: r.user_id,
        name: r.name,
        email: r.email,
        role: r.role,
        joinedAt: r.joined_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/invites', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet || pet.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Только владелец может просматривать приглашения' });
    }

    const { rows } = await pool.query(
      `SELECT id, invitee_email, status, created_at, token
       FROM family_invites
       WHERE pet_id = $1 AND status = 'pending'
       ORDER BY created_at DESC`,
      [req.params.petId]
    );

    res.json({
      invites: rows.map((r) => ({
        id: r.id,
        inviteeEmail: r.invitee_email,
        status: r.status,
        createdAt: r.created_at,
        token: r.token,
        inviteLink: buildInviteLink(r.token),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/invite', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet || pet.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Только владелец может приглашать членов семьи' });
    }

    const memberCount = await getFamilyMemberCount(req.params.petId);
    if (memberCount >= MAX_FAMILY_MEMBERS) {
      return res.status(403).json({
        error: `Максимум ${MAX_FAMILY_MEMBERS} пользователей на одного питомца`,
      });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email обязателен' });
    }

    const inviteeEmail = email.toLowerCase().trim();
    if (inviteeEmail === req.currentUser.email) {
      return res.status(400).json({ error: 'Нельзя пригласить самого себя' });
    }

    const { rows: userRows } = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [inviteeEmail]
    );

    if (userRows[0]) {
      const existing = await pool.query(
        'SELECT 1 FROM pet_members WHERE pet_id = $1 AND user_id = $2',
        [req.params.petId, userRows[0].id]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Пользователь уже добавлен к этому питомцу' });
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO family_invites (pet_id, inviter_id, invitee_email)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.params.petId, req.user.id, inviteeEmail]
    );

    res.status(201).json({
      invite: {
        id: rows[0].id,
        inviteeEmail: rows[0].invitee_email,
        status: rows[0].status,
        token: rows[0].token,
        inviteLink: buildInviteLink(rows[0].token),
        createdAt: rows[0].created_at,
      },
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Приглашение уже отправлено' });
    }
    next(err);
  }
});

export default router;

export const invitesRouter = Router();

invitesRouter.get('/preview/:token', async (req, res, next) => {
  try {
    const { rows: inviteRows } = await pool.query(
      `SELECT fi.*, p.name AS pet_name, u.name AS inviter_name
       FROM family_invites fi
       JOIN pets p ON p.id = fi.pet_id
       JOIN users u ON u.id = fi.inviter_id
       WHERE fi.token = $1 AND fi.status = 'pending'`,
      [req.params.token]
    );

    if (inviteRows[0]) {
      return res.json({
        type: 'email',
        petName: inviteRows[0].pet_name,
        inviterName: inviteRows[0].inviter_name,
        inviteeEmail: inviteRows[0].invitee_email,
      });
    }

    const { rows: petRows } = await pool.query(
      `SELECT u.id, u.name AS owner_name,
              (SELECT COUNT(*)::int FROM pets WHERE owner_id = u.id) AS pet_count
       FROM users u
       WHERE u.family_referral_token = $1`,
      [req.params.token]
    );

    if (petRows[0]) {
      const count = petRows[0].pet_count;
      return res.json({
        type: 'referral',
        inviterName: petRows[0].owner_name,
        petName: count > 1 ? `все питомцы (${count})` : 'профиль питомца',
      });
    }

    const { rows: legacyPetRows } = await pool.query(
      `SELECT p.id, p.name, u.name AS owner_name
       FROM pets p
       JOIN users u ON u.id = p.owner_id
       WHERE p.family_referral_token = $1`,
      [req.params.token]
    );

    if (legacyPetRows[0]) {
      return res.json({
        type: 'referral',
        petId: legacyPetRows[0].id,
        petName: legacyPetRows[0].name,
        inviterName: legacyPetRows[0].owner_name,
      });
    }

    res.status(404).json({ error: 'Приглашение не найдено' });
  } catch (err) {
    next(err);
  }
});

invitesRouter.use(authenticate, loadUser);

invitesRouter.get('/my-invites', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT fi.id, fi.token, fi.created_at, p.id AS pet_id, p.name AS pet_name, u.name AS inviter_name
       FROM family_invites fi
       JOIN pets p ON p.id = fi.pet_id
       JOIN users u ON u.id = fi.inviter_id
       WHERE fi.invitee_email = $1 AND fi.status = 'pending'
       ORDER BY fi.created_at DESC`,
      [req.currentUser.email]
    );

    res.json({
      invites: rows.map((r) => ({
        id: r.id,
        token: r.token,
        petId: r.pet_id,
        petName: r.pet_name,
        inviterName: r.inviter_name,
        createdAt: r.created_at,
        inviteLink: buildInviteLink(r.token),
      })),
    });
  } catch (err) {
    next(err);
  }
});

invitesRouter.get('/my-referral-link', async (req, res, next) => {
  try {
    if (!isPremium(req.currentUser)) {
      return res.status(403).json({ error: 'Реферальная ссылка доступна только с Premium' });
    }

    const token = await ensureUserReferralToken(req.user.id);
    res.json({
      referralLink: buildReferralLink(token),
      token,
    });
  } catch (err) {
    next(err);
  }
});

invitesRouter.post('/my-referral-link/regenerate', async (req, res, next) => {
  try {
    if (!isPremium(req.currentUser)) {
      return res.status(403).json({ error: 'Реферальная ссылка доступна только с Premium' });
    }

    const { rows } = await pool.query(
      'UPDATE users SET family_referral_token = gen_random_uuid() WHERE id = $1 RETURNING family_referral_token',
      [req.user.id]
    );

    res.json({
      referralLink: buildReferralLink(rows[0].family_referral_token),
      token: rows[0].family_referral_token,
    });
  } catch (err) {
    next(err);
  }
});

async function acceptUserReferral(req, res, ownerId) {
  const { rows: ownerRows } = await pool.query(
    'SELECT subscription_tier, subscription_expires_at FROM users WHERE id = $1',
    [ownerId]
  );
  const owner = ownerRows[0];
  const ownerPremium = owner?.subscription_tier === 'premium' &&
    (!owner.subscription_expires_at || new Date(owner.subscription_expires_at) > new Date());

  if (!ownerPremium) {
    return res.status(403).json({ error: 'Семейный доступ доступен только у Premium-владельца' });
  }

  if (ownerId === req.user.id) {
    return res.status(400).json({ error: 'Нельзя принять своё приглашение' });
  }

  const { rows: pets } = await pool.query(
    'SELECT id, name FROM pets WHERE owner_id = $1 ORDER BY created_at ASC',
    [ownerId]
  );

  if (pets.length === 0) {
    return res.status(404).json({ error: 'У владельца пока нет питомцев' });
  }

  let added = 0;
  for (const pet of pets) {
    const memberCount = await getFamilyMemberCount(pet.id);
    if (memberCount >= MAX_FAMILY_MEMBERS) continue;

    const existing = await pool.query(
      'SELECT 1 FROM pet_members WHERE pet_id = $1 AND user_id = $2',
      [pet.id, req.user.id]
    );
    if (existing.rows.length > 0) continue;

    await pool.query(
      'INSERT INTO pet_members (pet_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [pet.id, req.user.id, 'member']
    );
    added += 1;
  }

  if (added === 0) {
    return res.status(409).json({ error: 'Вы уже добавлены ко всем питомцам или достигнут лимит семьи' });
  }

  return res.json({
    success: true,
    petId: pets[0].id,
    petName: added > 1 ? `все питомцы (${added})` : pets[0].name,
    petsAdded: added,
  });
}

async function acceptReferral(req, res, next, token) {
  const { rows: userRows } = await pool.query(
    'SELECT id FROM users WHERE family_referral_token = $1',
    [token]
  );

  if (userRows[0]) {
    return acceptUserReferral(req, res, userRows[0].id);
  }

  const { rows: petRows } = await pool.query(
    `SELECT p.*, u.subscription_tier, u.subscription_expires_at
     FROM pets p
     JOIN users u ON u.id = p.owner_id
     WHERE p.family_referral_token = $1`,
    [token]
  );

  const pet = petRows[0];
  if (!pet) {
    return res.status(404).json({ error: 'Приглашение не найдено' });
  }

  const ownerPremium = pet.subscription_tier === 'premium' &&
    (!pet.subscription_expires_at || new Date(pet.subscription_expires_at) > new Date());

  if (!ownerPremium) {
    return res.status(403).json({ error: 'Семейный доступ доступен только у Premium-владельца' });
  }

  if (pet.owner_id === req.user.id) {
    return res.status(400).json({ error: 'Вы уже владелец этого питомца' });
  }

  const existing = await pool.query(
    'SELECT 1 FROM pet_members WHERE pet_id = $1 AND user_id = $2',
    [pet.id, req.user.id]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Вы уже добавлены к этому питомцу' });
  }

  const memberCount = await getFamilyMemberCount(pet.id);
  if (memberCount >= MAX_FAMILY_MEMBERS) {
    return res.status(403).json({ error: 'Достигнут лимит членов семьи' });
  }

  await pool.query(
    'INSERT INTO pet_members (pet_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [pet.id, req.user.id, 'member']
  );

  return res.json({
    success: true,
    petId: pet.id,
    petName: pet.name,
  });
}

invitesRouter.post('/accept/:token', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT fi.*, p.name AS pet_name
       FROM family_invites fi
       JOIN pets p ON p.id = fi.pet_id
       WHERE fi.token = $1 AND fi.status = 'pending'`,
      [req.params.token]
    );

    const invite = rows[0];
    if (!invite) {
      return acceptReferral(req, res, next, req.params.token);
    }

    if (invite.invitee_email && invite.invitee_email !== req.currentUser.email) {
      return res.status(403).json({ error: 'Это приглашение адресовано другому пользователю' });
    }

    const memberCount = await getFamilyMemberCount(invite.pet_id);
    if (memberCount >= MAX_FAMILY_MEMBERS) {
      return res.status(403).json({ error: 'Достигнут лимит членов семьи' });
    }

    await pool.query('BEGIN');
    try {
      await pool.query(
        'INSERT INTO pet_members (pet_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [invite.pet_id, req.user.id, 'member']
      );
      await pool.query(
        "UPDATE family_invites SET status = 'accepted' WHERE id = $1",
        [invite.id]
      );
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }

    res.json({
      success: true,
      petId: invite.pet_id,
      petName: invite.pet_name,
    });
  } catch (err) {
    next(err);
  }
});
