import { useId } from 'react';

// The app's locked logo mark ("bitten disc", design system L1): a filled disc
// with a bite-notch cut from the top-right and a thin horizontal split.
interface LogoMarkProps {
  size: number;
  color?: string;
}

const LogoMark = ({ size, color = '#fff' }: LogoMarkProps) => {
  const maskId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <mask id={maskId}>
          <rect width="64" height="64" fill="#fff" />
          <circle cx="55" cy="11" r="13" fill="#000" />
          <rect x="0" y="29.5" width="64" height="5" fill="#000" />
        </mask>
      </defs>
      <circle cx="32" cy="32" r="26" fill={color} mask={`url(#${maskId})`} />
    </svg>
  );
};

export default LogoMark;
