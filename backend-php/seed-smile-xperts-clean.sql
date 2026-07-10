PRAGMA foreign_keys = OFF;

DELETE FROM Feedback;
DELETE FROM GalleryItem;
DELETE FROM Invoice;
DELETE FROM Appointment;
DELETE FROM ClientPackage;
DELETE FROM PackageItem;
DELETE FROM Package;
DELETE FROM InventoryTransaction;
DELETE FROM InventoryItem;
DELETE FROM Campaign;
DELETE FROM WhatsAppCampaign;
DELETE FROM WhatsAppAutomationLog;
DELETE FROM WhatsAppQueue;
DELETE FROM WhatsAppMessage;
DELETE FROM WhatsAppConversation;
DELETE FROM WhatsAppWebhookLog;
DELETE FROM WhatsAppMediaLibrary;
DELETE FROM Service;
DELETE FROM Staff;
DELETE FROM Branch;

UPDATE Client
SET totalSpent = 0,
    outstandingBalance = 0,
    latestInvoiceNo = NULL,
    lastVisit = NULL,
    nextFollowUpDue = NULL;

UPDATE Clinic
SET name = 'The Smile Xperts',
    tagline = 'Premier Multi-Specialty Dental Clinic & Implant Centre in F-8 Islamabad',
    address = 'Block 03, Flat No. 01, Street 33, Sector F-8/1, Islamabad.',
    phone = '+92 310-5704555',
    whatsapp = '+92 310-5704555',
    email = 'info@thesmilexperts.com',
    website = 'thesmilexperts.com',
    registrationNo = '',
    invoicePrefix = 'TSX',
    invoiceFooter = 'Thank you for trusting The Smile Xperts. We always take care of your smile.',
    paymentTerms = 'Payment is due at the time of treatment unless a written plan is approved by clinic administration.',
    mission = 'To deliver advanced dental care with precision, comfort, transparent communication, and long-lasting results.',
    vision = 'To be Islamabad''s trusted multi-specialty dental clinic for expert-led family dentistry, orthodontics, implants, and smile aesthetics.',
    servicesOverview = 'Endodontics, orthodontics, prosthodontics, dental implants, general and aesthetic dentistry, preventive care, and oral surgery under one roof.',
    primaryColor = '#0f766e',
    secondaryColor = '#134e4a',
    font = 'Inter',
    specialties = 'dental'
WHERE id = 'clinic-smile-expert-001';

INSERT INTO Branch (id, clinicId, name, address, phone, isActive, whatsappNumber)
VALUES (
    'branch-smile-xperts-f8',
    'clinic-smile-expert-001',
    'The Smile Xperts F-8 Islamabad',
    'Block 03, Flat No. 01, Street 33, Sector F-8/1, Islamabad.',
    '+92 310-5704555',
    1,
    '+92 310-5704555'
);

INSERT INTO Staff (id, clinicId, branchId, name, role, designation, specialty, phone, email, avatar, avatarColor, qualifications, experience, bio, workingDays, workingHours, status, rating, compensationType, fixedSalary, commissionRate, treatmentCommissionRates, portalRole, loginEmail, inviteStatus)
VALUES
('doc-mushtaq-ahmed', 'clinic-smile-expert-001', 'branch-smile-xperts-f8', 'Dr. Mushtaq Ahmed', 'Principal Dental Surgeon', 'Principal Dental Surgeon (Retd)', 'dental', '+92 310-5704555', 'info@thesmilexperts.com', 'MA', '#0f766e', 'BDS, RDS', 'Senior consultant', 'Principal Dental Surgeon (Retd) B.B.H. Rawalpindi and Chief Dental Surgeon (Retd) Services Hospital, Lahore.', 'Mon,Tue,Wed,Thu,Fri,Sat', '11:00-21:00', 'active', 5.0, 'commission', 0, 0, '{}', 'doctor', 'mushtaq@thesmilexperts.com', 'ready'),
('doc-osama-mushtaq', 'clinic-smile-expert-001', 'branch-smile-xperts-f8', 'Dr. Osama Mushtaq', 'Oral and Maxillofacial Surgeon', 'Consultant Oral and Maxillofacial Surgeon', 'dental', '+92 310-5704555', 'info@thesmilexperts.com', 'OM', '#2563eb', 'BDS, FCPS, CHPE, PGD', 'Consultant', 'Assistant Professor IIDH and Consultant Oral and Maxillofacial Surgeon.', 'Mon,Tue,Wed,Thu,Fri,Sat', '11:00-21:00', 'active', 5.0, 'commission', 0, 0, '{}', 'doctor', 'osama@thesmilexperts.com', 'ready'),
('doc-huda-ali-khan', 'clinic-smile-expert-001', 'branch-smile-xperts-f8', 'Dr. Huda Ali Khan', 'General Dentist', 'General Dentist', 'dental', '+92 310-5704555', 'info@thesmilexperts.com', 'HK', '#be3455', 'BDS, RDS', 'General dentistry', 'General dentist focused on comfortable, clear, and preventive patient care.', 'Mon,Tue,Wed,Thu,Fri,Sat', '11:00-21:00', 'active', 5.0, 'commission', 0, 0, '{}', 'doctor', 'huda@thesmilexperts.com', 'ready'),
('doc-maryam-mushtaq', 'clinic-smile-expert-001', 'branch-smile-xperts-f8', 'Dr. Maryam Mushtaq', 'Orthodontist', 'Consultant Orthodontist', 'dental', '+92 310-5704555', 'info@thesmilexperts.com', 'MM', '#7c3aed', 'BDS, FCPS, MHPE', 'Consultant', 'Consultant orthodontist for braces, aligners, retainers, and smile alignment planning.', 'Mon,Tue,Wed,Thu,Fri,Sat', '11:00-21:00', 'active', 5.0, 'commission', 0, 0, '{}', 'doctor', 'maryam@thesmilexperts.com', 'ready'),
('doc-talha-mushtaq', 'clinic-smile-expert-001', 'branch-smile-xperts-f8', 'Dr. Talha Mushtaq', 'Endodontist', 'Consultant Endodontist', 'dental', '+92 310-5704555', 'info@thesmilexperts.com', 'TM', '#f59e0b', 'BDS, MDS', 'Consultant', 'Consultant endodontist for root canal treatment, dental pain management, and tooth preservation.', 'Mon,Tue,Wed,Thu,Fri,Sat', '11:00-21:00', 'active', 5.0, 'commission', 0, 0, '{}', 'doctor', 'talha@thesmilexperts.com', 'ready');

INSERT INTO Service (id, clinicId, name, specialty, category, price, duration, description, popular, isActive)
VALUES
('svc-endodontics', 'clinic-smile-expert-001', 'Endodontics', 'dental', 'Endodontics', 0, 45, 'Root canal and tooth-saving treatment by endodontic specialists.', 1, 1),
('svc-root-canal', 'clinic-smile-expert-001', 'Root Canal Treatment', 'dental', 'Endodontics', 0, 60, 'Pain-managed root canal care with clear aftercare guidance.', 1, 1),
('svc-orthodontics', 'clinic-smile-expert-001', 'Orthodontics (Braces / Aligners)', 'dental', 'Orthodontics', 0, 45, 'Braces, aligners, retainers, and smile alignment planning.', 1, 1),
('svc-prosthodontics', 'clinic-smile-expert-001', 'Prosthodontics', 'dental', 'Prosthodontics', 0, 45, 'Crowns, bridges, dentures, and restorative treatment planning.', 1, 1),
('svc-implants-surgery', 'clinic-smile-expert-001', 'Dental Implants & Oral Surgery', 'dental', 'Oral Surgery', 0, 60, 'Dental implants, oral surgery consultation, and surgical treatment planning.', 1, 1),
('svc-general-aesthetic', 'clinic-smile-expert-001', 'General & Aesthetic Dentistry', 'dental', 'General Dentistry', 0, 30, 'Routine dental care, aesthetic smile improvement, fillings, and consultations.', 1, 1),
('svc-preventive-care', 'clinic-smile-expert-001', 'Preventive Care', 'dental', 'Preventive Care', 0, 30, 'Checkups, scaling, polishing, hygiene guidance, and preventive dental care.', 1, 1),
('svc-routine-checkup', 'clinic-smile-expert-001', 'Routine Checkup', 'dental', 'Consultation', 0, 30, 'General oral health assessment for new and returning patients.', 0, 1),
('svc-new-patient-visit', 'clinic-smile-expert-001', 'New Patient Visit', 'dental', 'Consultation', 0, 30, 'First visit consultation with treatment discussion and appointment planning.', 0, 1),
('svc-specific-concern', 'clinic-smile-expert-001', 'Specific Concern Consultation', 'dental', 'Consultation', 0, 30, 'Focused consultation for pain, swelling, broken tooth, braces, implant, or cosmetic concerns.', 0, 1);

INSERT INTO PublicSiteConfig (clinicId, configJson, updatedAt)
VALUES ('clinic-smile-expert-001', '{
  "announcement": "Need help? +92 310-5704555",
  "eyebrow": "Expert care for the smile you deserve",
  "heroTitle": "A Higher Standard of Oral Care.",
  "heroSubtitle": "Visit Islamabad’s premier Multi-Specialty Dental Clinic and Implant Centre in F-8. Expert care, conveniently located in the heart of F-8.",
  "heroImage": "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=1400&q=85",
  "aboutTitle": "Why Islamabad trusts The Smile Xperts",
  "aboutText": "At The Smile Xperts, we combine advanced dental technology with personalized care to deliver exceptional results. Our experienced team focuses on precision, comfort, and long-term oral health.",
  "hours": "Mon - Sat: 11:00 AM - 9:00 PM",
  "bookingNote": "Fill out the form and our front desk team will contact you to confirm your slot.",
  "googleMapsUrl": "https://maps.google.com/?q=Block%2003%20Flat%20No.%2001%20Street%2033%20Sector%20F-8%2F1%20Islamabad",
  "googleBusinessUrl": "",
  "seoTitle": "The Smile Xperts | Multi-Specialty Dental Clinic in F-8 Islamabad",
  "seoDescription": "Book dental implants, orthodontics, root canal, prosthodontics, preventive care, and general aesthetic dentistry at The Smile Xperts Islamabad.",
  "ogImage": "",
  "socials": {"facebook": "", "instagram": "", "tiktok": "", "youtube": ""},
  "nav": [
    {"label": "Home", "href": "#home"},
    {"label": "Services", "href": "#services"},
    {"label": "Doctors", "href": "#doctors"},
    {"label": "FAQs", "href": "#faq"},
    {"label": "Appointment", "href": "#book"},
    {"label": "Contact Us", "href": "#map"}
  ],
  "sections": {"offers": false, "services": true, "doctors": true, "gallery": true, "testimonials": true, "about": true, "faq": true, "map": true, "booking": true},
  "sectionOrder": ["services", "doctors", "gallery", "testimonials", "about", "faq", "map", "booking"],
  "offers": [],
  "faqs": [
    {"question": "What are your sterilization protocols?", "answer": "Your safety is our priority. We strictly follow hospital-grade sterilization, autoclave cycles, and disposable barriers for every patient."},
    {"question": "How much do dental implants cost in Islamabad?", "answer": "Dental implant cost depends on implant type, materials, bone condition, and individual treatment needs. Please book a consultation for an accurate estimate."},
    {"question": "Is the procedure painful?", "answer": "Most procedures are performed with local anesthesia and careful comfort planning. The team explains every step before treatment."},
    {"question": "How long do implants last?", "answer": "With good planning, hygiene, and follow-up care, implants can last many years. Your doctor will guide maintenance after treatment."}
  ]
}', CURRENT_TIMESTAMP)
ON CONFLICT(clinicId) DO UPDATE SET configJson = excluded.configJson, updatedAt = CURRENT_TIMESTAMP;

UPDATE Subscription
SET billingCycle = 'monthly',
    amountPKR = 50000,
    expiresAt = CASE
      WHEN expiresAt < datetime('now', '+1 month') THEN datetime('now', '+1 month')
      ELSE expiresAt
    END,
    status = 'active'
WHERE clinicId = 'clinic-smile-expert-001'
  AND status = 'active';

INSERT INTO Subscription (id, clinicId, billingCycle, amountPKR, startsAt, expiresAt, status)
SELECT 'sub-smile-xperts-monthly-50000', 'clinic-smile-expert-001', 'monthly', 50000, CURRENT_TIMESTAMP, datetime('now', '+1 month'), 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM Subscription
  WHERE clinicId = 'clinic-smile-expert-001'
    AND status = 'active'
)
ON CONFLICT(id) DO UPDATE SET
  billingCycle = excluded.billingCycle,
  amountPKR = excluded.amountPKR,
  expiresAt = excluded.expiresAt,
  status = excluded.status;

PRAGMA foreign_keys = ON;
