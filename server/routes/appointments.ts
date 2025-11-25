import { Router } from 'express';
import { randomUUID } from 'crypto';

interface AppointmentSlot {
  id: string;
  start: string;
  end: string;
  visitType: 'in_person' | 'telehealth';
  status: 'available' | 'booked';
}

interface AppointmentBooking {
  id: string;
  doctorNpi: string;
  slotId: string;
  patientName: string;
  patientEmail?: string;
  visitType: 'in_person' | 'telehealth';
  reason: string;
  insurancePlan?: string;
  createdAt: string;
}

const appointmentRoutes = Router();

// Lightweight in-memory store for demo purposes
const availabilityStore = new Map<string, AppointmentSlot[]>();
const bookingStore: AppointmentBooking[] = [];

function generateSlotsForNpi(doctorNpi: string): AppointmentSlot[] {
  if (availabilityStore.has(doctorNpi)) {
    return availabilityStore.get(doctorNpi)!;
  }

  const slots: AppointmentSlot[] = [];
  const now = new Date();

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    for (const hour of [9, 10, 11, 13, 14, 15, 16]) {
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + dayOffset,
        hour,
        0,
        0,
        0
      );
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const isTelehealth = hour >= 13;
      slots.push({
        id: randomUUID(),
        start: start.toISOString(),
        end: end.toISOString(),
        visitType: isTelehealth ? 'telehealth' : 'in_person',
        status: 'available',
      });
    }
  }

  availabilityStore.set(doctorNpi, slots);
  return slots;
}

appointmentRoutes.post('/availability', (req, res) => {
  const { doctorNpi } = req.body;

  if (!doctorNpi) {
    return res.status(400).json({ error: 'doctorNpi is required' });
  }

  const slots = generateSlotsForNpi(doctorNpi).filter(
    slot => slot.status === 'available'
  );

  res.json({
    doctorNpi,
    slots,
    generatedAt: new Date().toISOString(),
  });
});

appointmentRoutes.post('/book', (req, res) => {
  const {
    doctorNpi,
    slotId,
    visitType,
    reason,
    insurancePlan,
    patientName,
    patientEmail,
  } = req.body;

  if (!doctorNpi || !slotId || !visitType || !patientName) {
    return res.status(400).json({
      error: 'doctorNpi, slotId, visitType, and patientName are required',
    });
  }

  const slots = generateSlotsForNpi(doctorNpi);
  const slot = slots.find(s => s.id === slotId);

  if (!slot || slot.status !== 'available') {
    return res.status(409).json({
      error: 'Selected slot is no longer available',
    });
  }

  slot.status = 'booked';

  const booking: AppointmentBooking = {
    id: randomUUID(),
    doctorNpi,
    slotId: slot.id,
    patientName,
    patientEmail,
    visitType,
    reason,
    insurancePlan,
    createdAt: new Date().toISOString(),
  };

  bookingStore.push(booking);

  res.json({
    confirmationId: booking.id,
    doctorNpi,
    slot: {
      start: slot.start,
      end: slot.end,
      visitType: slot.visitType,
    },
    status: 'confirmed',
    message: 'Appointment booked successfully. You will receive a confirmation email shortly.',
  });
});

export { appointmentRoutes };

