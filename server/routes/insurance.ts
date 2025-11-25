import { Router } from 'express';

interface InsuranceCheckResult {
  doctorNpi: string;
  insurancePlan: string;
  isInNetwork: boolean;
  copay: number;
  requiresReferral: boolean;
  message: string;
}

const insuranceRoutes = Router();

const mockInsuranceMatrix: Record<string, Record<string, InsuranceCheckResult>> = {
  '1578567890': {
    'Aetna Silver': {
      doctorNpi: '1578567890',
      insurancePlan: 'Aetna Silver',
      isInNetwork: true,
      copay: 35,
      requiresReferral: false,
      message: 'In-network specialist visit. Standard copay applies.',
    },
    'BlueShield PPO': {
      doctorNpi: '1578567890',
      insurancePlan: 'BlueShield PPO',
      isInNetwork: true,
      copay: 25,
      requiresReferral: false,
      message: 'Preferred provider. Lower copay available.',
    },
  },
};

const defaultPlans = ['Aetna Silver', 'BlueShield PPO', 'United Gold', 'Medicare Part B'];

insuranceRoutes.post('/verify', (req, res) => {
  const { doctorNpi, insurancePlan } = req.body;

  if (!doctorNpi || !insurancePlan) {
    return res.status(400).json({ error: 'doctorNpi and insurancePlan are required' });
  }

  const doctorPlans = mockInsuranceMatrix[doctorNpi];
  if (doctorPlans && doctorPlans[insurancePlan]) {
    return res.json(doctorPlans[insurancePlan]);
  }

  const fallbackResult: InsuranceCheckResult = {
    doctorNpi,
    insurancePlan,
    isInNetwork: defaultPlans.includes(insurancePlan),
    copay: defaultPlans.includes(insurancePlan) ? 45 : 90,
    requiresReferral: insurancePlan.toLowerCase().includes('hmo'),
    message: defaultPlans.includes(insurancePlan)
      ? 'In-network coverage confirmed based on payer rules.'
      : 'Out-of-network. Higher copay or reimbursement applies.',
  };

  res.json(fallbackResult);
});

insuranceRoutes.get('/plans', (_req, res) => {
  res.json({
    plans: defaultPlans,
    message: 'Static plans for prototype. Integrate with payer clearinghouse for production.',
  });
});

export { insuranceRoutes };

