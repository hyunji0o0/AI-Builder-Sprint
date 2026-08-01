import { ReactNode } from 'react'

export type IconName =
  | 'sparkle' | 'home' | 'check' | 'folder' | 'users' | 'person'
  | 'file' | 'clock' | 'alert' | 'wallet' | 'send' | 'calendar'
  | 'upload' | 'building' | 'heart' | 'edit'
  | 'search' | 'shield' | 'mapPin' | 'car' | 'phone' | 'arrowLeft'
  | 'chevronLeft' | 'chevronRight' | 'close' | 'trash'

const iconPaths: Record<IconName, ReactNode> = {
  sparkle: <><path d="m12 2 1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"/><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/></>,
  home: <><path d="m3 11 9-7 9 7"/><path d="M5.5 10v9h13v-9M9 19v-6h6v6"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  folder: <path d="M3.5 7.5h6l2-2h9v13h-17z"/>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-4 2.5-6 5.5-6s5 2 5.5 6M15 6a3 3 0 0 1 0 5M16 13c2.5.3 4 2.3 4.5 5"/></>,
  person: <><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.6-4.7 2.8-7 6.5-7s5.9 2.3 6.5 7"/></>,
  file: <><path d="M6 3.5h8l4 4V20H6z"/><path d="M14 3.5V8h4M9 12h6M9 16h5"/></>,
  clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></>,
  alert: <><path d="M12 3 3.5 20h17z"/><path d="M12 9v4M12 17h.01"/></>,
  wallet: <><path d="M4 6h16v13H4z"/><path d="M4 9h16M15 13h5v4h-5z"/></>,
  send: <><path d="m3 11 18-8-7.5 18-2.2-7.3z"/><path d="M11.3 13.7 21 3"/></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></>,
  upload: <><path d="M12 16V4m-4 4 4-4 4 4"/><path d="M5 14v6h14v-6"/></>,
  building: <><path d="M4 21V8l8-5 8 5v13M2 21h20"/><path d="M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3"/></>,
  heart: <path d="M20 8.5c0 5-8 10-8 10s-8-5-8-10A4.5 4.5 0 0 1 12 5.7a4.5 4.5 0 0 1 8 2.8z"/>,
  edit: <><path d="m4 20 4-.8L19 8.2 15.8 5 4.8 16zM14.5 6.3l3.2 3.2"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></>,
  shield: <><path d="M12 3 5 6v5c0 4.5 2.6 7.8 7 10 4.4-2.2 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-5"/></>,
  mapPin: <><path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11z"/><circle cx="12" cy="10" r="2"/></>,
  car: <><path d="m5 11 2-5h10l2 5M4 11h16v7H4z"/><circle cx="7" cy="17" r="1.5"/><circle cx="17" cy="17" r="1.5"/></>,
  phone: <><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M10 6h4M11 18h2"/></>,
  arrowLeft: <><path d="m15 5-7 7 7 7"/><path d="M8 12h12"/></>,
  chevronLeft: <path d="m15 5-7 7 7 7"/>,
  chevronRight: <path d="m9 5 7 7-7 7"/>,
  close: <path d="M5 5 19 19M19 5 5 19"/>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></>,
}

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name]}
    </svg>
  )
}
