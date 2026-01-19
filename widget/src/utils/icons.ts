/**
 * Modern SVG Icons for the Widget
 * Clean, minimal icons using inline SVG
 */

export const Icons = {
  /**
   * Close/X icon
   */
  close: (color = 'currentColor') => `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 5L5 15M5 5L15 15" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  /**
   * Send icon
   */
  send: (color = 'currentColor') => `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 2L9 11M18 2L12 18L9 11M18 2L2 8L9 11" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  /**
   * Microphone icon
   */
  mic: (color = 'currentColor') => `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 1V11M10 11C11.6569 11 13 9.65685 13 8V4C13 2.34315 11.6569 1 10 1C8.34315 1 7 2.34315 7 4V8C7 9.65685 8.34315 11 10 11Z" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5 8V9C5 12.3137 7.68629 15 11 15M15 8V9C15 12.3137 12.3137 15 9 15" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10 15V19M6 19H14" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  /**
   * Phone/End call icon
   */
  phone: (color = 'currentColor') => `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 3L6.58289 6.58289C7.13714 7.13714 7.13714 8.06286 6.58289 8.61711L5.29289 9.90711C6.51297 12.2071 8.79289 14.487 11.0929 15.7071L12.3829 14.4171C12.9371 13.8629 13.8629 13.8629 14.4171 14.4171L18 18C18.5523 18.5523 18.5523 19.4477 18 20C8.05887 20 0 11.9411 0 2C0 1.44772 0.447715 1 1 1L3 3Z" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  /**
   * Emoji/Smile icon
   */
  emoji: (color = 'currentColor') => `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" stroke="${color}" stroke-width="2"/>
      <circle cx="7" cy="8" r="1" fill="${color}"/>
      <circle cx="13" cy="8" r="1" fill="${color}"/>
      <path d="M7 13C7 13 8.5 15 10 15C11.5 15 13 13 13 13" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `,

  /**
   * Chat/Message icon
   */
  chat: (color = 'currentColor') => `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 9C18 13.4183 14.4183 17 10 17C8.50829 17 7.11201 16.6102 5.90661 15.9333L2 17L3.06667 13.0934C2.38981 11.888 2 10.4917 2 9C2 4.58172 5.58172 1 10 1C14.4183 1 18 4.58172 18 9Z" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,
}









