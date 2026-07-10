export function isImageLogo(value) {
  return typeof value === 'string' && (
    value.startsWith('data:image/') ||
    value.startsWith('http://') ||
    value.startsWith('https://')
  );
}

export function getLogoInitials(value, fallback = 'SE') {
  if (typeof value !== 'string' || !value.trim() || isImageLogo(value)) {
    return fallback;
  }

  const words = value.trim().split(/[^a-z0-9]+/i).filter(Boolean);
  if (words.length > 1) {
    return words.map((word) => word[0]).join('').slice(0, 4).toUpperCase();
  }
  return value.trim().slice(0, 4).toUpperCase();
}

function escapeXml(value = '') {
  return String(value).replace(/[<>&'"]/g, (char) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[char]));
}

export function getBrandIconUrl(clinicInfo = {}) {
  if (isImageLogo(clinicInfo.logo)) return clinicInfo.logo;
  const initials = escapeXml(getLogoInitials(clinicInfo.logo || clinicInfo.name));
  const primary = clinicInfo.primaryColor || '#0f766e';
  const secondary = clinicInfo.secondaryColor || '#be3455';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="48" y1="48" x2="464" y2="464"><stop stop-color="${primary}"/><stop offset="1" stop-color="${secondary}"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="#0f1720"/><rect x="36" y="36" width="440" height="440" rx="96" fill="url(#g)"/><text x="256" y="292" text-anchor="middle" font-family="Arial,sans-serif" font-size="142" font-weight="900" fill="white">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function ensureLink(rel, selector = `link[rel="${rel}"]`) {
  let link = document.head.querySelector(selector);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  return link;
}

export function syncBrandingMetadata(clinicInfo = {}) {
  if (typeof document === 'undefined') return;
  const name = clinicInfo.name || 'Clinic Portal';
  const tagline = clinicInfo.tagline || 'Clinic management portal';
  const iconUrl = getBrandIconUrl(clinicInfo);
  const themeColor = clinicInfo.primaryColor || '#0f766e';
  const appBase = import.meta.env.BASE_URL || '/';

  document.title = `${name} - Clinic Portal`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', `${name}: ${tagline}`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);

  const favicon = ensureLink('icon');
  favicon.type = iconUrl.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/png';
  favicon.href = iconUrl;
  ensureLink('apple-touch-icon').href = iconUrl;

  const manifest = {
    name: `${name} Portal`,
    short_name: name.slice(0, 24),
    description: tagline,
    start_url: `${appBase}dashboard`,
    scope: appBase,
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f6f7f9',
    theme_color: themeColor,
    categories: ['medical', 'business', 'productivity'],
    icons: [{ src: iconUrl, sizes: '512x512', type: iconUrl.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/png', purpose: 'any maskable' }],
  };
  ensureLink('manifest').href = `data:application/manifest+json;charset=UTF-8,${encodeURIComponent(JSON.stringify(manifest))}`;
}
