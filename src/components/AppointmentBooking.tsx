import { useEffect, useMemo, useState, useCallback } from 'react';
import { CalendarDays, CheckCircle2, Clock4, ShieldCheck, Video, Building2, AlertCircle } from 'lucide-react';
import { appointmentsApi, AppointmentSlot, insuranceApi } from '../lib/api';

type DoctorSummary = {
  name: string;
  specialty: string;
  location: string;
  phone: string;
  npi?: string;
  acceptedInsurances?: string[];
  telehealth?: boolean;
  inPerson?: boolean;
  afterHours?: boolean;
};

type InsuranceResult = {
  doctorNpi: string;
  insurancePlan: string;
  isInNetwork: boolean;
  copay: number;
  requiresReferral: boolean;
  message: string;
};

const DEFAULT_PLANS = ['Aetna Silver', 'BlueShield PPO', 'United Gold', 'Medicare Part B'];

function formatSlotLabel(slot: AppointmentSlot) {
  const date = new Date(slot.start);
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: 'numeric',
  });

  return {
    date: formatter.format(date),
    time: timeFormatter.format(date),
  };
}

export function AppointmentBookingCard({ doctor }: { doctor: DoctorSummary }) {
  const [expanded, setExpanded] = useState(false);
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [visitType, setVisitType] = useState<'in_person' | 'telehealth'>('in_person');
  const [reason, setReason] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [insurancePlan, setInsurancePlan] = useState(DEFAULT_PLANS[0]);
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [insurancePlans, setInsurancePlans] = useState<string[]>(DEFAULT_PLANS);
  const [insuranceResult, setInsuranceResult] = useState<InsuranceResult | null>(null);
  const [checkingInsurance, setCheckingInsurance] = useState(false);
  const [bookingState, setBookingState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);

  const groupedSlots = useMemo(() => {
    return slots.reduce<Record<string, AppointmentSlot[]>>((acc, slot) => {
      const dateLabel = new Date(slot.start).toDateString();
      if (!acc[dateLabel]) {
        acc[dateLabel] = [];
      }
      if (slot.visitType === visitType) {
        acc[dateLabel].push(slot);
      }
      return acc;
    }, {});
  }, [slots, visitType]);

  useEffect(() => {
    let isMounted = true;
    insuranceApi
      .getPlans()
      .then(data => {
        if (isMounted && data.plans?.length) {
          setInsurancePlans(data.plans);
          setInsurancePlan(data.plans[0]);
        }
      })
      .catch(() => {
        // Ignore failures; fallback plans remain
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const fetchAvailability = useCallback(async () => {
    if (!doctor.npi) return;
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const response = await appointmentsApi.getAvailability(doctor.npi);
      setSlots(response.slots || []);
    } catch (error) {
      console.error('Availability error', error);
      setSlotsError('Unable to load availability. Please try again shortly.');
    } finally {
      setSlotsLoading(false);
    }
  }, [doctor.npi]);

  useEffect(() => {
    if (expanded && doctor.npi) {
      void fetchAvailability();
    }
  }, [expanded, doctor.npi, fetchAvailability]);

  const handleInsuranceCheck = async () => {
    if (!doctor.npi) return;
    setCheckingInsurance(true);
    setBookingMessage(null);
    try {
      const result = await insuranceApi.verifyInsurance(doctor.npi, insurancePlan);
      setInsuranceResult(result);
    } catch (error) {
      console.error('Insurance check failed', error);
      setInsuranceResult(null);
      setBookingMessage('Insurance verification failed. Please try again.');
    } finally {
      setCheckingInsurance(false);
    }
  };

  const handleBooking = async () => {
    if (!doctor.npi || !selectedSlotId || !patientName) {
      setBookingMessage('Please select a slot and enter your name.');
      return;
    }
    setBookingState('saving');
    setBookingMessage(null);
    try {
      const response = await appointmentsApi.bookAppointment({
        doctorNpi: doctor.npi,
        slotId: selectedSlotId,
        visitType,
        reason,
        insurancePlan,
        patientName,
        patientEmail,
      });
      setBookingState('success');
      setBookingMessage(response.message);
      setSelectedSlotId(null);
      setReason('');
      setSymptoms('');
    } catch (error) {
      console.error('Booking failed', error);
      setBookingState('error');
      setBookingMessage('Booking failed. Please try a different slot.');
    } finally {
      setTimeout(() => setBookingState('idle'), 4000);
    }
  };

  const acceptedInsurances = doctor.acceptedInsurances || ['Aetna', 'Blue Shield', 'Medicare'];

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="badge flex items-center gap-1">
          <Building2 className="w-3 h-3" /> {doctor.inPerson === false ? 'Telehealth only' : 'In-person'}
        </span>
        <span className="badge flex items-center gap-1">
          <Video className="w-3 h-3" /> {doctor.telehealth === false ? 'Office visit' : 'Telehealth ready'}
        </span>
        {doctor.afterHours && (
          <span className="badge bg-purple-50 text-purple-700 border-purple-200">After-hours</span>
        )}
      </div>
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
      >
        <CalendarDays className="w-4 h-4" />
        {expanded ? 'Hide Booking Options' : 'Book Appointment'}
      </button>

      {expanded && (
        <div className="mt-4 space-y-5 rounded-2xl border border-blue-100 bg-white/80 p-4">
          {!doctor.npi && (
            <p className="text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Booking unavailable: missing NPI identifier.
            </p>
          )}

          {doctor.npi && (
            <>
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-heading text-base">Insurance verification</h4>
                  <button
                    onClick={handleInsuranceCheck}
                    disabled={checkingInsurance}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    {checkingInsurance ? 'Checking...' : 'Verify insurance'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {acceptedInsurances.slice(0, 4).map(plan => (
                    <span
                      key={plan}
                      className="badge text-xs flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-100"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      {plan}
                    </span>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Insurance plan</label>
                    <select
                      className="input-professional mt-1"
                      value={insurancePlan}
                      onChange={e => setInsurancePlan(e.target.value)}
                    >
                      {insurancePlans.map(plan => (
                        <option key={plan} value={plan}>
                          {plan}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    {insuranceResult ? (
                      <div className="flex flex-col text-sm">
                        <span className="font-semibold text-green-600">
                          {insuranceResult.isInNetwork ? 'In-network' : 'Out-of-network'}
                        </span>
                        <span className="text-gray-600">Copay ${insuranceResult.copay}</span>
                        {insuranceResult.requiresReferral && (
                          <span className="text-amber-600 text-xs">Referral required</span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Verify to see in-network status and copay details.
                      </p>
                    )}
                  </div>
                </div>
                {insuranceResult && (
                  <p className="text-xs text-gray-600 bg-green-50 border border-green-100 rounded-xl p-3">
                    {insuranceResult.message}
                  </p>
                )}
              </section>

              <section className="space-y-3">
                <h4 className="text-heading text-base">Visit type & slot</h4>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setVisitType('in_person')}
                    className={`flex-1 rounded-xl border px-4 py-2 text-sm ${
                      visitType === 'in_person'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    In-person
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisitType('telehealth')}
                    className={`flex-1 rounded-xl border px-4 py-2 text-sm ${
                      visitType === 'telehealth'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    Telehealth
                  </button>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {slotsLoading && <p className="text-sm text-gray-500">Loading availability...</p>}
                  {slotsError && <p className="text-sm text-red-600">{slotsError}</p>}
                  {!slotsLoading && !slotsError && Object.keys(groupedSlots).length === 0 && (
                    <p className="text-sm text-gray-500">No slots for this visit type in the next week.</p>
                  )}
                  {Object.entries(groupedSlots).map(([dateLabel, daySlots]) => (
                    <div key={dateLabel} className="rounded-2xl border border-gray-100 p-3">
                      <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-2">
                        <Clock4 className="w-3 h-3" />
                        {dateLabel}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {daySlots.map(slot => {
                          const { time, date } = formatSlotLabel(slot);
                          return (
                            <button
                              type="button"
                              key={slot.id}
                              onClick={() => setSelectedSlotId(slot.id)}
                              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                selectedSlotId === slot.id
                                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 text-gray-600 hover:border-blue-300'
                              }`}
                            >
                              <span className="block">{time}</span>
                              <span className="text-[10px] text-gray-400">{date}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-heading text-base">Appointment details</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Your full name</label>
                    <input
                      className="input-professional mt-1"
                      value={patientName}
                      onChange={e => setPatientName(e.target.value)}
                      placeholder="Patient name"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Contact email (optional)</label>
                    <input
                      className="input-professional mt-1"
                      value={patientEmail}
                      onChange={e => setPatientEmail(e.target.value)}
                      placeholder="you@email.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Reason for visit</label>
                  <textarea
                    className="input-professional mt-1 min-h-[80px]"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="e.g., follow-up for retina surgery, vision changes"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Symptoms / notes</label>
                  <input
                    className="input-professional mt-1"
                    value={symptoms}
                    onChange={e => setSymptoms(e.target.value)}
                    placeholder="blurred vision, floaters"
                  />
                </div>
              </section>

              {bookingMessage && (
                <p
                  className={`text-sm rounded-xl p-3 ${
                    bookingState === 'success'
                      ? 'bg-green-50 border border-green-100 text-green-700'
                      : 'bg-amber-50 border border-amber-100 text-amber-700'
                  }`}
                >
                  {bookingMessage}
                </p>
              )}

              <button
                onClick={handleBooking}
                disabled={bookingState === 'saving'}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {bookingState === 'saving' ? (
                  <>
                    <Clock4 className="w-4 h-4 animate-spin" />
                    Booking...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm appointment
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

