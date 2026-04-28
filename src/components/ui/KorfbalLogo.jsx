import React from 'react';

/**
 * Aerial korf mark — concentric rings viewed from above.
 * variant: 'light' | 'dark' | 'red' | 'mono'
 */
export function KorfbalLogo({ size = 32, variant = 'light', className = '' }) {
  const r = size;
  const cx = r / 2;

  if (variant === 'mono') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 192 192" role="img" aria-label="Korfbal Score" className={className}>
        <circle cx="96" cy="96" r="62" fill="none" stroke="currentColor" strokeWidth="10" />
        <circle cx="96" cy="96" r="42" fill="none" stroke="currentColor" strokeWidth="7" opacity="0.5" />
        <circle cx="96" cy="96" r="10" fill="currentColor" />
        <circle cx="151" cy="58" r="11" fill="currentColor" />
      </svg>
    );
  }

  if (variant === 'red') {
    const s = size / 64;
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Korfbal Score" className={className}>
        <rect width="64" height="64" rx={13 * s * (64 / size)} fill="#DC2626" />
        <circle cx="32" cy="32" r="20" fill="none" stroke="#FAFAF7" strokeWidth="4" />
        <circle cx="32" cy="32" r="3.5" fill="#FAFAF7" />
        <circle cx="50" cy="20" r="4.5" fill="#FAFAF7" />
      </svg>
    );
  }

  if (variant === 'dark') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 192 192" role="img" aria-label="Korfbal Score" className={className}>
        <rect width="192" height="192" rx="38" fill="#0A0D12" />
        <circle cx="96" cy="96" r="62" fill="none" stroke="#FAFAF7" strokeWidth="10" />
        <circle cx="96" cy="96" r="42" fill="none" stroke="#DC2626" strokeWidth="7" />
        <circle cx="96" cy="96" r="10" fill="#FAFAF7" />
        <circle cx="151" cy="58" r="11" fill="#DC2626" />
      </svg>
    );
  }

  // default: light
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 192 192" role="img" aria-label="Korfbal Score" className={className}>
      <rect width="192" height="192" rx="38" fill="#FAFAF7" />
      <circle cx="96" cy="96" r="62" fill="none" stroke="#0A0D12" strokeWidth="10" />
      <circle cx="96" cy="96" r="42" fill="none" stroke="#DC2626" strokeWidth="7" />
      <circle cx="96" cy="96" r="10" fill="#0A0D12" />
      <circle cx="151" cy="58" r="11" fill="#DC2626" />
    </svg>
  );
}
