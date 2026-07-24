import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useClinic } from './ClinicContext';

const STORAGE_KEY = 'patientflow_training_state_v1';

export const TRAINING_TOURS = [
  {
    id: 'first-patient-flow',
    title: 'First Patient Flow',
    plan: 'All plans',
    audience: 'Reception and new staff',
    duration: '6-8 min',
    description: 'Learn the daily front-desk path: add a patient, book an appointment, create an invoice, and review billing.',
    steps: [
      {
        title: 'Start With the Core Clinic Flow',
        body: 'This guided demo shows the normal front-desk journey. You can skip it now and replay it later from this Help button.',
        path: '/dashboard',
      },
      {
        title: 'Add the Patient First',
        body: 'Open the patient register from here when a new visitor arrives. In a real session, click this button and save the patient profile.',
        path: '/clients',
        selector: '[data-training="patients-new-button"]',
        actionHint: 'Click New Patient to open the form, then continue.',
      },
      {
        title: 'Capture the Basic Profile',
        body: 'The patient form is template-based. Name and phone are the first fields staff should complete so later appointment and invoice search works.',
        path: '/clients',
        selector: '[data-training="patient-field-name"]',
        actionHint: 'If the form is closed, click New Patient first.',
      },
      {
        title: 'Save the Patient',
        body: 'Saving the profile creates the patient record that the appointment and invoice screens will use. If the modal is not open, click New Patient first.',
        path: '/clients',
        selector: '[data-training="patient-save-button"]',
        actionHint: 'This button appears inside the New Patient form.',
      },
      {
        title: 'Book the Visit',
        body: 'Next, create the appointment. Patient, service, doctor, fee, date, and source should be captured once so billing can reuse them.',
        path: '/appointments',
        selector: '[data-training="appointments-new-button"]',
        actionHint: 'Click New Appointment to open the booking form.',
      },
      {
        title: 'Select Patient and Treatment',
        body: 'Search the patient, pick the treatment/service, and confirm the staff member and fee. This is the key data invoice automation depends on.',
        path: '/appointments',
        selector: '[data-training="appointment-patient-field"]',
        actionHint: 'This field appears inside the appointment form.',
      },
      {
        title: 'Create the Invoice',
        body: 'After the visit, create an invoice. Patient selection can auto-link the latest appointment and prefill treatment details.',
        path: '/invoices',
        selector: '[data-training="invoices-new-button"]',
        actionHint: 'Click New Invoice to open the billing form.',
      },
      {
        title: 'Confirm Appointment Prefill',
        body: 'Choose the patient and check the linked appointment. The line items, fee, paid amount, due date, and payment method complete the bill.',
        path: '/invoices',
        selector: '[data-training="invoice-patient-field"]',
        actionHint: 'This field appears inside the invoice form.',
      },
      {
        title: 'Review and Share',
        body: 'Once saved, staff can view the invoice, mark payment, download PDF, and send a WhatsApp follow-up. This completes the first training flow.',
        path: '/invoices',
        selector: '[data-training="invoice-list"]',
      },
    ],
  },
  {
    id: 'daily-reception-close',
    title: 'Daily Reception Close',
    plan: 'All plans',
    audience: 'Reception and owner handover',
    duration: '3-4 min',
    description: 'Review today’s appointments, prepare pending bills, and send the owner a clean closeout summary.',
    steps: [
      {
        title: 'Open the Reception Desk',
        body: 'Reception Desk is the daily command center: same-day visits, invoice preparation, old dues, and cash handover all meet here.',
        path: '/reception',
        selector: '[data-training="nav-reception"]',
      },
      {
        title: 'Review Today’s Schedule',
        body: 'Use the schedule to see pending, checked-in, completed, cancelled, and no-show appointments before closing the day.',
        path: '/reception',
        selector: '[data-training="reception-today-schedule"]',
      },
      {
        title: 'Create Missing Invoices',
        body: 'Each appointment can move directly into invoice creation with patient and appointment details already prepared.',
        path: '/reception',
        selector: '[data-training="reception-quick-invoice"]',
      },
      {
        title: 'Send Owner Close',
        body: 'At end of day, send the owner closeout summary with appointments, cash, card/bank payments, open balances, and old dues.',
        path: '/reception',
        selector: '[data-training="reception-day-close-button"]',
      },
    ],
  },
  {
    id: 'finance-basics',
    title: 'Owner Finance Review',
    plan: 'Owner / manager training',
    audience: 'Owners and finance users',
    duration: '4-5 min',
    description: 'Understand invoices, dues, expenses, procedure cost, and daily financial review.',
    steps: [
      {
        title: 'Billing Starts From Invoices',
        body: 'Invoices show live revenue, paid amounts, balances, and patient dues. Use this screen before daily close.',
        path: '/invoices',
        selector: '[data-training="invoices-new-button"]',
      },
      {
        title: 'Owner Review Lives in Financials',
        body: 'Financials is where owners review revenue, expenses, profit, procedure cost, and clinic-level reporting.',
        path: '/financials',
        selector: '[data-training="nav-financials"]',
      },
      {
        title: 'Record Expenses',
        body: 'Add rent, bills, salaries, supplies, and other clinic costs so net profit reports stay realistic.',
        path: '/financials',
        selector: '[data-training="financials-expense-editor"]',
      },
      {
        title: 'Review Profitability',
        body: 'Use profitability and procedure cost sections to understand which services produce margin after material and lab costs.',
        path: '/financials',
        selector: '[data-training="financials-profitability"]',
      },
    ],
  },
  {
    id: 'operations-setup',
    title: 'Operations Setup',
    plan: 'All plans',
    audience: 'Managers and setup staff',
    duration: '5-6 min',
    description: 'Configure staff, services, inventory, and settings before the clinic team starts daily work.',
    steps: [
      {
        title: 'Add Staff Accounts',
        body: 'Create doctors, assistants, receptionists, and managers with role-based portal access and compensation settings.',
        path: '/staff',
        selector: '[data-training="nav-staff"]',
      },
      {
        title: 'Set Up Services',
        body: 'Services define treatment names, fees, duration, and billing defaults that appointments and invoices reuse.',
        path: '/services',
        selector: '[data-training="nav-services"]',
      },
      {
        title: 'Track Inventory',
        body: 'Inventory helps monitor stock, expiry, low quantity warnings, purchase price, and usage planning.',
        path: '/inventory',
        selector: '[data-training="nav-inventory"]',
      },
      {
        title: 'Finalize Clinic Settings',
        body: 'Settings controls branding, public website, payment terms, domain, branches, and contact details used across the portal.',
        path: '/settings',
        selector: '[data-training="nav-settings"]',
      },
    ],
  },
  {
    id: 'growth-setup',
    title: 'Growth and AI Setup',
    plan: 'Growth / AI plans',
    audience: 'Owners and growth teams',
    duration: '5-7 min',
    description: 'Set up WhatsApp, outreach, Meta leads, and AI receptionist workflows when those features are active.',
    anyRequiredFeatures: ['marketingEnabled', 'whatsappEnabled', 'aiEnabled', 'metaLeadsEnabled'],
    lockedDescription: 'Activate Marketing, WhatsApp, Meta Leads, or AI for this clinic to unlock growth training.',
    steps: [
      {
        title: 'Start With Manual Outreach',
        body: 'Lower plans can still use manual WhatsApp actions for reminders, follow-ups, and patient reactivation.',
        path: '/outreach',
        selector: '[data-training="nav-outreach"]',
      },
      {
        title: 'Build Marketing Campaigns',
        body: 'Marketing keeps campaign drafts, triggers, message types, and activation status organized before automation takes over.',
        path: '/marketing',
        selector: '[data-training="nav-marketing"]',
        featureKey: 'marketingEnabled',
      },
      {
        title: 'Upgrade to WhatsApp Center',
        body: 'When enabled, WhatsApp Center manages templates, automations, campaigns, and branch routing.',
        path: '/whatsapp',
        selector: '[data-training="nav-whatsapp"]',
        featureKey: 'whatsappEnabled',
      },
      {
        title: 'Train the AI Receptionist',
        body: 'AI Receptionist has its own setup wizard for tone, language, greetings, knowledge base, sandbox testing, and activation.',
        path: '/ai-receptionist',
        selector: '[data-training="nav-aiReceptionist"]',
        featureKey: 'aiEnabled',
      },
      {
        title: 'Connect Meta Leads',
        body: 'Meta Leads brings campaign leads into the clinic pipeline so follow-up and conversion can be tracked in one place.',
        path: '/meta-leads',
        selector: '[data-training="nav-metaLeads"]',
        featureKey: 'metaLeadsEnabled',
      },
    ],
  },
];

const TrainingContext = createContext(null);

function hasFeature(features, key) {
  return !key || Boolean(features?.[key]);
}

export function getTrainingTourSteps(tour, features = {}) {
  return (tour?.steps || []).filter(step => hasFeature(features, step.featureKey));
}

export function isTrainingTourAvailable(tour, features = {}) {
  const required = tour?.requiredFeatures || [];
  const anyRequired = tour?.anyRequiredFeatures || [];
  const allRequiredPass = required.every(key => hasFeature(features, key));
  const anyRequiredPass = anyRequired.length === 0 || anyRequired.some(key => hasFeature(features, key));
  return allRequiredPass && anyRequiredPass && getTrainingTourSteps(tour, features).length > 0;
}

function readState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      completedTours: Array.isArray(parsed.completedTours) ? parsed.completedTours : [],
      skippedTours: Array.isArray(parsed.skippedTours) ? parsed.skippedTours : [],
      lastOpenedAt: parsed.lastOpenedAt || null,
    };
  } catch (_) {
    return { completedTours: [], skippedTours: [], lastOpenedAt: null };
  }
}

export function TrainingProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { features } = useClinic();
  const [centerOpen, setCenterOpen] = useState(false);
  const [state, setState] = useState(readState);
  const [activeTourId, setActiveTourId] = useState(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const activeTour = useMemo(
    () => TRAINING_TOURS.find(tour => tour.id === activeTourId) || null,
    [activeTourId]
  );
  const activeSteps = useMemo(
    () => getTrainingTourSteps(activeTour, features),
    [activeTour, features]
  );
  const activeStep = activeSteps[activeStepIndex] || null;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!activeStep?.path || location.pathname === activeStep.path) return;
    navigate(activeStep.path);
  }, [activeStep?.path, location.pathname, navigate]);

  useEffect(() => {
    if (!activeTour) return;
    if (activeSteps.length === 0) {
      setActiveTourId(null);
      setActiveStepIndex(0);
      return;
    }
    if (activeStepIndex > activeSteps.length - 1) {
      setActiveStepIndex(activeSteps.length - 1);
    }
  }, [activeTour, activeStepIndex, activeSteps.length]);

  const updateState = (updater) => {
    setState(current => {
      const next = updater(current);
      return {
        completedTours: [...new Set(next.completedTours || [])],
        skippedTours: [...new Set(next.skippedTours || [])],
        lastOpenedAt: next.lastOpenedAt || current.lastOpenedAt || null,
      };
    });
  };

  const openTrainingCenter = () => {
    updateState(current => ({ ...current, lastOpenedAt: new Date().toISOString() }));
    setCenterOpen(true);
  };

  const startTour = (tourId) => {
    const tour = TRAINING_TOURS.find(item => item.id === tourId);
    if (!tour || !isTrainingTourAvailable(tour, features)) return;
    setCenterOpen(false);
    setActiveTourId(tourId);
    setActiveStepIndex(0);
  };

  const finishTour = () => {
    if (activeTourId) {
      updateState(current => ({
        ...current,
        completedTours: [...current.completedTours, activeTourId],
        skippedTours: current.skippedTours.filter(id => id !== activeTourId),
      }));
    }
    setActiveTourId(null);
    setActiveStepIndex(0);
  };

  const skipTour = () => {
    if (activeTourId) {
      updateState(current => ({ ...current, skippedTours: [...current.skippedTours, activeTourId] }));
    }
    setActiveTourId(null);
    setActiveStepIndex(0);
  };

  const nextStep = () => {
    if (!activeTour) return;
    if (activeStepIndex >= activeSteps.length - 1) {
      finishTour();
      return;
    }
    setActiveStepIndex(index => index + 1);
  };

  const previousStep = () => {
    setActiveStepIndex(index => Math.max(0, index - 1));
  };

  const resetTrainingProgress = () => {
    setState({ completedTours: [], skippedTours: [], lastOpenedAt: null });
    setActiveTourId(null);
    setActiveStepIndex(0);
  };

  const value = {
    tours: TRAINING_TOURS,
    centerOpen,
    openTrainingCenter,
    closeTrainingCenter: () => setCenterOpen(false),
    startTour,
    activeTour,
    activeStep,
    activeStepIndex,
    totalSteps: activeSteps.length,
    nextStep,
    previousStep,
    skipTour,
    finishTour,
    resetTrainingProgress,
    completedTours: state.completedTours,
    skippedTours: state.skippedTours,
  };

  return (
    <TrainingContext.Provider value={value}>
      {children}
    </TrainingContext.Provider>
  );
}

export function useTraining() {
  const context = useContext(TrainingContext);
  if (!context) {
    throw new Error('useTraining must be used inside TrainingProvider');
  }
  return context;
}
