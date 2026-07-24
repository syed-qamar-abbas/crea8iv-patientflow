-- Seed Dental Aesthetic Clinic (DAC) with Dr. Urooj Khalid from the provided business card.
-- Idempotent MySQL migration for production/staging imports.

INSERT INTO `Clinic` (
  `id`, `name`, `tagline`, `address`, `phone`, `whatsapp`, `email`, `website`,
  `registrationNo`, `invoicePrefix`, `invoiceFooter`, `paymentTerms`,
  `mission`, `vision`, `servicesOverview`, `primaryColor`, `secondaryColor`,
  `font`, `specialties`, `slug`, `customDomain`, `status`, `clinicType`
) VALUES (
  'clinic-dac-001',
  'Dental Aesthetic Clinic',
  'Dental, aesthetic and laser clinic in Bahria Town Islamabad',
  'LG Shop #2, Plaza 55, Civic Center, Phase 4, Bahria Town, Islamabad.',
  '+92 51 275 3222',
  '+92 335 0176453',
  'info@dacclinic.pk',
  '',
  '',
  'DAC',
  'Thank you for choosing Dental Aesthetic Clinic.',
  'Payment is due at the time of treatment unless clinic administration approves a plan.',
  'To provide careful dental, aesthetic, implant and laser treatments with clear communication and patient comfort.',
  'To be a trusted dental and aesthetic clinic for Bahria Town Islamabad families.',
  'Laser dentistry, dental implants, fillings, aesthetic treatments, fillers and botox.',
  '#9a6a2f',
  '#0f766e',
  'Inter',
  'dental',
  'dac',
  NULL,
  'active',
  'dental'
) ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `tagline` = VALUES(`tagline`),
  `address` = VALUES(`address`),
  `phone` = VALUES(`phone`),
  `whatsapp` = VALUES(`whatsapp`),
  `email` = VALUES(`email`),
  `invoicePrefix` = VALUES(`invoicePrefix`),
  `invoiceFooter` = VALUES(`invoiceFooter`),
  `paymentTerms` = VALUES(`paymentTerms`),
  `mission` = VALUES(`mission`),
  `vision` = VALUES(`vision`),
  `servicesOverview` = VALUES(`servicesOverview`),
  `primaryColor` = VALUES(`primaryColor`),
  `secondaryColor` = VALUES(`secondaryColor`),
  `font` = VALUES(`font`),
  `specialties` = VALUES(`specialties`),
  `slug` = VALUES(`slug`),
  `status` = VALUES(`status`),
  `clinicType` = VALUES(`clinicType`);

INSERT INTO `Branch` (`id`, `clinicId`, `name`, `address`, `phone`, `isActive`, `whatsappNumber`)
VALUES (
  'branch-dac-bahria-phase-4',
  'clinic-dac-001',
  'DAC Bahria Town Phase 4',
  'LG Shop #2, Plaza 55, Civic Center, Phase 4, Bahria Town, Islamabad.',
  '+92 51 275 3222',
  1,
  '+92 335 0176453'
) ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `address` = VALUES(`address`),
  `phone` = VALUES(`phone`),
  `isActive` = VALUES(`isActive`),
  `whatsappNumber` = VALUES(`whatsappNumber`);

INSERT INTO `Staff` (
  `id`, `clinicId`, `branchId`, `name`, `role`, `designation`, `specialty`,
  `phone`, `email`, `avatar`, `avatarColor`, `qualifications`, `experience`,
  `bio`, `workingDays`, `workingHours`, `status`, `rating`,
  `compensationType`, `fixedSalary`, `commissionRate`, `treatmentCommissionRates`,
  `portalRole`, `loginEmail`, `inviteStatus`
) VALUES (
  'doc-urooj-khalid',
  'clinic-dac-001',
  'branch-dac-bahria-phase-4',
  'Dr. Urooj Khalid',
  'Dental Aesthetic Physician',
  'Certified Aesthetic Physician & Laser Specialist',
  'dental',
  '+92 335 0176453',
  'info@dacclinic.pk',
  'UK',
  '#9a6a2f',
  'BDS RDS (C-Implant, C-Endo, C-Ortho)',
  'Certified aesthetic physician',
  'Certified aesthetic physician and laser specialist offering laser dentistry, implants, fillings, fillers and botox.',
  'Mon,Tue,Wed,Thu,Fri,Sat',
  '12:00-22:00',
  'active',
  5.00,
  'commission',
  0,
  0,
  '{}',
  'doctor',
  'urooj@dacclinic.pk',
  'ready'
) ON DUPLICATE KEY UPDATE
  `branchId` = VALUES(`branchId`),
  `name` = VALUES(`name`),
  `role` = VALUES(`role`),
  `designation` = VALUES(`designation`),
  `specialty` = VALUES(`specialty`),
  `phone` = VALUES(`phone`),
  `email` = VALUES(`email`),
  `avatar` = VALUES(`avatar`),
  `avatarColor` = VALUES(`avatarColor`),
  `qualifications` = VALUES(`qualifications`),
  `experience` = VALUES(`experience`),
  `bio` = VALUES(`bio`),
  `workingDays` = VALUES(`workingDays`),
  `workingHours` = VALUES(`workingHours`),
  `status` = VALUES(`status`),
  `rating` = VALUES(`rating`),
  `portalRole` = VALUES(`portalRole`),
  `loginEmail` = VALUES(`loginEmail`);

INSERT INTO `Service` (`id`, `clinicId`, `name`, `specialty`, `category`, `price`, `duration`, `description`, `popular`, `isActive`)
VALUES
('svc-dac-laser', 'clinic-dac-001', 'Laser Dentistry', 'dental', 'Laser', 0, 45, 'Laser dental consultation and treatment planning.', 1, 1),
('svc-dac-implant', 'clinic-dac-001', 'Dental Implant Consultation', 'dental', 'Implants', 0, 45, 'Implant assessment and treatment planning.', 1, 1),
('svc-dac-fillings', 'clinic-dac-001', 'Dental Fillings', 'dental', 'Restorative Dentistry', 0, 30, 'Aesthetic and restorative dental fillings.', 1, 1),
('svc-dac-fillers', 'clinic-dac-001', 'Fillers', 'dental', 'Aesthetic Treatments', 0, 30, 'Aesthetic filler consultation and treatment.', 0, 1),
('svc-dac-botox', 'clinic-dac-001', 'Botox', 'dental', 'Aesthetic Treatments', 0, 30, 'Botox consultation and treatment.', 0, 1)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `specialty` = VALUES(`specialty`),
  `category` = VALUES(`category`),
  `duration` = VALUES(`duration`),
  `description` = VALUES(`description`),
  `popular` = VALUES(`popular`),
  `isActive` = VALUES(`isActive`);

INSERT INTO `PublicSiteConfig` (`clinicId`, `configJson`, `updatedAt`)
VALUES (
  'clinic-dac-001',
  '{"announcement":"Need help? WhatsApp +92 335 0176453","eyebrow":"Dental, aesthetic and laser care","heroTitle":"Dental Aesthetic Clinic","heroSubtitle":"Laser dentistry, implants, fillings, fillers and botox in Bahria Town Islamabad.","heroImage":"https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=1400&q=85","aboutTitle":"Care by Dr. Urooj Khalid","aboutText":"DAC combines dental treatment, aesthetic medicine and laser care with clear guidance and patient comfort.","hours":"Mon - Sat: 12:00 PM - 10:00 PM","bookingNote":"Choose a service and request a time with Dr. Urooj Khalid. The clinic team will confirm your slot.","googleMapsUrl":"https://maps.google.com/?q=LG%20Shop%20%232%2C%20Plaza%2055%2C%20Civic%20Center%2C%20Phase%204%2C%20Bahria%20Town%2C%20Islamabad","googleBusinessUrl":"","seoTitle":"Dental Aesthetic Clinic | DAC Bahria Town Islamabad","seoDescription":"Book laser dentistry, dental implants, fillings, fillers and botox at Dental Aesthetic Clinic in Bahria Town Islamabad.","ogImage":"","socials":{"facebook":"","instagram":"","tiktok":"","youtube":""},"nav":[{"label":"Services","href":"#services"},{"label":"Doctor","href":"#doctors"},{"label":"Book now","href":"#book"},{"label":"Contact","href":"#map"}],"sections":{"offers":false,"services":true,"doctors":true,"gallery":false,"testimonials":true,"about":true,"faq":true,"map":true,"booking":true},"sectionOrder":["services","doctors","testimonials","about","faq","map","booking"],"offers":[],"faqs":[{"question":"What are DAC clinic timings?","answer":"DAC is open Monday to Saturday from 12:00 PM to 10:00 PM."},{"question":"Where is DAC located?","answer":"LG Shop #2, Plaza 55, Civic Center, Phase 4, Bahria Town, Islamabad."},{"question":"Which treatments are available?","answer":"Laser dentistry, implants, fillings, fillers, botox and aesthetic consultations are available."}]}',
  CURRENT_TIMESTAMP
) ON DUPLICATE KEY UPDATE
  `configJson` = VALUES(`configJson`),
  `updatedAt` = CURRENT_TIMESTAMP;
