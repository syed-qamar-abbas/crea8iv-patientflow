import { getLogoInitials, isImageLogo } from '../../utils/branding';

export default function ClinicLogoMark({
  logo,
  alt = 'Clinic logo',
  className = '',
  textClassName = '',
  imageClassName = '',
  style,
}) {
  return (
    <div className={className} style={style}>
      {isImageLogo(logo) ? (
        <img
          src={logo}
          alt={alt}
          className={imageClassName || 'w-full h-full object-contain'}
        />
      ) : (
        <span className={textClassName}>{getLogoInitials(logo)}</span>
      )}
    </div>
  );
}
