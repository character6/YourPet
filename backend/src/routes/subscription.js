import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, loadUser, isPremium } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, loadUser);

const PLANS = {
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 499,
    currency: 'RUB',
    period: 'month',
    features: [
      'Семейный доступ до 5 человек',
      'Коллективный календарь',
      'Неограниченное количество питомцев',
      'Аналитика веса и активности',
      'Экспорт PDF-отчётов',
    ],
  },
  free: {
    id: 'free',
    name: 'Бесплатный',
    price: 0,
    currency: 'RUB',
    period: 'forever',
    features: [
      '1 питомец',
      'Дневник здоровья',
      'Напоминания',
      'Загрузка документов',
    ],
  },
};

router.get('/plans', (_req, res) => {
  res.json({ plans: Object.values(PLANS) });
});

router.get('/status', (req, res) => {
  const premium = isPremium(req.currentUser);
  res.json({
    tier: premium ? 'premium' : 'free',
    expiresAt: req.currentUser.subscription_expires_at,
    isPremium: premium,
  });
});

router.post('/subscribe', async (req, res, next) => {
  try {
    const { planId, paymentMethod } = req.body;
    if (planId !== 'premium') {
      return res.status(400).json({ error: 'Доступен только план Premium' });
    }
    if (!paymentMethod) {
      return res.status(400).json({ error: 'Укажите способ оплаты' });
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const { rows } = await pool.query(
      `UPDATE users
       SET subscription_tier = 'premium', subscription_expires_at = $1
       WHERE id = $2
       RETURNING id, email, name, subscription_tier, subscription_expires_at, created_at`,
      [expiresAt, req.user.id]
    );

    res.json({
      success: true,
      message: 'Подписка Premium успешно оформлена (демо-оплата)',
      payment: {
        method: paymentMethod,
        amount: PLANS.premium.price,
        currency: PLANS.premium.currency,
        transactionId: `demo-${Date.now()}`,
      },
      user: {
        id: rows[0].id,
        email: rows[0].email,
        name: rows[0].name,
        subscriptionTier: rows[0].subscription_tier,
        subscriptionExpiresAt: rows[0].subscription_expires_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/cancel', async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE users SET subscription_tier = 'free', subscription_expires_at = NULL WHERE id = $1`,
      [req.user.id]
    );

    res.json({ success: true, message: 'Подписка отменена' });
  } catch (err) {
    next(err);
  }
});

export default router;
