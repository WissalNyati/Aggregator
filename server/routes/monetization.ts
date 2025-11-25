import { Router, Request } from 'express';
import { randomUUID } from 'crypto';

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

const monetizationRoutes = Router();

// Subscription tiers
type SubscriptionTier = 'free' | 'premium' | 'enterprise';
type UserRole = 'patient' | 'doctor' | 'admin';

interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  role: UserRole;
  startDate: string;
  endDate?: string;
  features: string[];
  referralCode?: string;
  referredBy?: string;
}

// In-memory store (replace with database in production)
const subscriptions = new Map<string, Subscription>();
const referralRewards = new Map<string, { referrerId: string; referredId: string; reward: number }>();

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

// Get user subscription
monetizationRoutes.get('/subscription', (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const subscription = subscriptions.get(userId) || {
    id: randomUUID(),
    userId,
    tier: 'free' as SubscriptionTier,
    role: 'patient' as UserRole,
    startDate: new Date().toISOString(),
    features: ['Basic search', 'Limited results'],
  };
  
  res.json(subscription);
});

// Upgrade subscription
monetizationRoutes.post('/subscription/upgrade', (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  const { tier } = req.body;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (!['premium', 'enterprise'].includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier' });
  }
  
  const features = {
    premium: [
      'Unlimited searches',
      'Priority booking',
      'Extended doctor profiles',
      'Medical record storage',
      'Family accounts',
      'Ad-free experience',
    ],
    enterprise: [
      'All premium features',
      'White-label solutions',
      'API access',
      'Custom integrations',
      'Analytics dashboard',
      'Dedicated support',
    ],
  };
  
  const subscription: Subscription = {
    id: randomUUID(),
    userId,
    tier: tier as SubscriptionTier,
    role: 'patient',
    startDate: new Date().toISOString(),
    features: features[tier as 'premium' | 'enterprise'],
  };
  
  subscriptions.set(userId, subscription);
  
  res.json({
    message: `Successfully upgraded to ${tier} tier`,
    subscription,
  });
});

// Generate referral code
monetizationRoutes.post('/referral/generate', (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const subscription = subscriptions.get(userId);
  if (!subscription || subscription.tier === 'free') {
    return res.status(403).json({ error: 'Referral program available for premium users only' });
  }
  
  const referralCode = `REF-${userId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  
  subscription.referralCode = referralCode;
  subscriptions.set(userId, subscription);
  
  res.json({
    referralCode,
    referralLink: `${process.env.CLIENT_URL || 'https://yodoc.netlify.app'}/signup?ref=${referralCode}`,
    message: 'Referral code generated successfully',
  });
});

// Apply referral code
monetizationRoutes.post('/referral/apply', (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  const { referralCode } = req.body;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (!referralCode) {
    return res.status(400).json({ error: 'Referral code is required' });
  }
  
  // Find referrer
  let referrerId: string | null = null;
  for (const [id, sub] of subscriptions.entries()) {
    if (sub.referralCode === referralCode) {
      referrerId = id;
      break;
    }
  }
  
  if (!referrerId) {
    return res.status(404).json({ error: 'Invalid referral code' });
  }
  
  // Apply referral benefits
  const newUserSubscription = subscriptions.get(userId) || {
    id: randomUUID(),
    userId,
    tier: 'free' as SubscriptionTier,
    role: 'patient' as UserRole,
    startDate: new Date().toISOString(),
    features: ['Basic search', 'Limited results', '1 month premium trial'],
  };
  
  newUserSubscription.referredBy = referrerId;
  subscriptions.set(userId, newUserSubscription);
  
  // Reward referrer (1 month premium extension or credit)
  referralRewards.set(randomUUID(), {
    referrerId,
    referredId: userId,
    reward: 1, // 1 month premium
  });
  
  res.json({
    message: 'Referral code applied successfully. You received 1 month premium trial!',
    subscription: newUserSubscription,
  });
});

// Get referral stats
monetizationRoutes.get('/referral/stats', (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const subscription = subscriptions.get(userId);
  if (!subscription?.referralCode) {
    return res.json({
      referralCode: null,
      totalReferrals: 0,
      activeReferrals: 0,
      rewards: [],
    });
  }
  
  const rewards = Array.from(referralRewards.values()).filter(r => r.referrerId === userId);
  const totalReferrals = rewards.length;
  const activeReferrals = rewards.filter(r => {
    const referredSub = subscriptions.get(r.referredId);
    return referredSub && referredSub.tier !== 'free';
  }).length;
  
  res.json({
    referralCode: subscription.referralCode,
    referralLink: `${process.env.CLIENT_URL || 'https://yodoc.netlify.app'}/signup?ref=${subscription.referralCode}`,
    totalReferrals,
    activeReferrals,
    rewards: rewards.map(r => ({
      referredId: r.referredId,
      reward: `${r.reward} month premium`,
      date: new Date().toISOString(),
    })),
  });
});

// Doctor practice features
monetizationRoutes.get('/practice/features', (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Check if user is a doctor
  const subscription = subscriptions.get(userId);
  const isDoctor = subscription?.role === 'doctor' || false;
  
  if (!isDoctor) {
    return res.json({
      available: false,
      message: 'Practice features available for verified doctors only',
    });
  }
  
  res.json({
    available: true,
    features: [
      'Profile verification badge',
      'Featured listings',
      'Appointment management',
      'Patient analytics',
      'Review management',
      'Insurance network updates',
    ],
    subscription: subscription || { tier: 'free', role: 'doctor' },
  });
});

// Enterprise features inquiry
monetizationRoutes.post('/enterprise/inquiry', (req, res) => {
  const { companyName, email, phone, requirements } = req.body;
  
  if (!companyName || !email) {
    return res.status(400).json({ error: 'Company name and email are required' });
  }
  
  // In production, send to sales team or CRM
  console.log('[ENTERPRISE INQUIRY]', {
    companyName,
    email,
    phone,
    requirements,
    timestamp: new Date().toISOString(),
  });
  
  res.json({
    message: 'Thank you for your interest! Our sales team will contact you within 24 hours.',
    inquiryId: randomUUID(),
  });
});

export { monetizationRoutes };

