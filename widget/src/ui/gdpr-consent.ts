/**
 * GDPR Consent Modal Component
 * Displays consent screen before allowing conversations
 */

export interface ConsentData {
  necessary: boolean // Always true, required for functionality
  analytics: boolean
  marketing: boolean
  dataProcessing: boolean
  timestamp: string
  ipAddress?: string
  userAgent?: string
}

export interface GDPRConsentConfig {
  theme: 'light' | 'dark'
  onConsent: (consent: ConsentData) => void
  onReject?: () => void
}

export class GDPRConsentModal {
  private config: GDPRConsentConfig
  private modal: HTMLDivElement | null = null
  private consentData: Partial<ConsentData> = {
    necessary: true, // Always required
  }

  constructor(config: GDPRConsentConfig) {
    this.config = config
  }

  /**
   * Show the GDPR consent modal
   */
  show(): void {
    if (this.modal) {
      return // Already shown
    }

    this.modal = document.createElement('div')
    this.modal.className = 'syntera-gdpr-modal'
    this.modal.setAttribute('role', 'dialog')
    this.modal.setAttribute('aria-labelledby', 'gdpr-title')
    this.modal.setAttribute('aria-modal', 'true')

    const isDark = this.config.theme === 'dark'
    const bgColor = isDark ? '#1a1a1a' : '#ffffff'
    const textColor = isDark ? '#e5e5e5' : '#1a1a1a'
    const borderColor = isDark ? '#333333' : '#e5e5e5'
    const primaryColor = '#3b82f6'
    const primaryHover = '#2563eb'

    this.modal.innerHTML = `
      <div class="syntera-gdpr-overlay"></div>
      <div class="syntera-gdpr-content">
        <div class="syntera-gdpr-header">
          <h2 id="gdpr-title" class="syntera-gdpr-title">🔒 Privacy & Data Protection</h2>
          <p class="syntera-gdpr-subtitle">We respect your privacy. Please review and accept our data processing terms to continue.</p>
        </div>
        
        <div class="syntera-gdpr-body">
          <div class="syntera-gdpr-section">
            <h3 class="syntera-gdpr-section-title">What data do we collect?</h3>
            <ul class="syntera-gdpr-list">
              <li>💬 <strong>Conversation messages</strong> - To provide AI assistance</li>
              <li>📧 <strong>Contact information</strong> - If you provide email/phone (optional)</li>
              <li>🌐 <strong>Technical data</strong> - IP address, browser type, device info</li>
            </ul>
          </div>

          <div class="syntera-gdpr-section">
            <h3 class="syntera-gdpr-section-title">How do we use your data?</h3>
            <ul class="syntera-gdpr-list">
              <li>✅ <strong>Necessary</strong> - Required for chat functionality (always enabled)</li>
              <li>📊 <strong>Analytics</strong> - To improve our service and understand usage patterns</li>
              <li>📧 <strong>Marketing</strong> - To send you relevant updates (with your consent)</li>
              <li>🤖 <strong>Data Processing</strong> - AI processing of your messages for responses</li>
            </ul>
          </div>

          <div class="syntera-gdpr-consents">
            <label class="syntera-gdpr-consent-item syntera-gdpr-consent-required">
              <input type="checkbox" checked disabled id="consent-necessary">
              <span class="syntera-gdpr-consent-label">
                <strong>Necessary Cookies</strong>
                <span class="syntera-gdpr-consent-desc">Required for chat functionality</span>
              </span>
            </label>

            <label class="syntera-gdpr-consent-item">
              <input type="checkbox" id="consent-analytics">
              <span class="syntera-gdpr-consent-label">
                <strong>Analytics</strong>
                <span class="syntera-gdpr-consent-desc">Help us improve by analyzing usage</span>
              </span>
            </label>

            <label class="syntera-gdpr-consent-item">
              <input type="checkbox" id="consent-marketing">
              <span class="syntera-gdpr-consent-label">
                <strong>Marketing</strong>
                <span class="syntera-gdpr-consent-desc">Receive updates and promotional content</span>
              </span>
            </label>

            <label class="syntera-gdpr-consent-item">
              <input type="checkbox" id="consent-processing" checked>
              <span class="syntera-gdpr-consent-label">
                <strong>Data Processing</strong>
                <span class="syntera-gdpr-consent-desc">AI processing of your messages (required for responses)</span>
              </span>
            </label>
          </div>

          <div class="syntera-gdpr-footer">
            <a href="#" class="syntera-gdpr-privacy-link" target="_blank">Privacy Policy</a>
            <a href="#" class="syntera-gdpr-privacy-link" target="_blank">Terms of Service</a>
          </div>
        </div>

        <div class="syntera-gdpr-actions">
          <button class="syntera-gdpr-button syntera-gdpr-button-reject" id="gdpr-reject">
            Reject All
          </button>
          <button class="syntera-gdpr-button syntera-gdpr-button-accept" id="gdpr-accept">
            Accept & Continue
          </button>
        </div>
      </div>
    `

    // Apply styles
    const style = document.createElement('style')
    style.textContent = `
      .syntera-gdpr-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }

      .syntera-gdpr-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
      }

      .syntera-gdpr-content {
        position: relative;
        background: ${bgColor};
        color: ${textColor};
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-width: 600px;
        max-height: 90vh;
        width: 90%;
        overflow-y: auto;
        z-index: 1;
      }

      .syntera-gdpr-header {
        padding: 24px;
        border-bottom: 1px solid ${borderColor};
      }

      .syntera-gdpr-title {
        margin: 0 0 8px 0;
        font-size: 24px;
        font-weight: 600;
        color: ${textColor};
      }

      .syntera-gdpr-subtitle {
        margin: 0;
        font-size: 14px;
        color: ${isDark ? '#a0a0a0' : '#666666'};
        line-height: 1.5;
      }

      .syntera-gdpr-body {
        padding: 24px;
      }

      .syntera-gdpr-section {
        margin-bottom: 24px;
      }

      .syntera-gdpr-section-title {
        margin: 0 0 12px 0;
        font-size: 16px;
        font-weight: 600;
        color: ${textColor};
      }

      .syntera-gdpr-list {
        margin: 0;
        padding-left: 20px;
        list-style: none;
      }

      .syntera-gdpr-list li {
        margin-bottom: 8px;
        font-size: 14px;
        line-height: 1.6;
        color: ${isDark ? '#d0d0d0' : '#444444'};
      }

      .syntera-gdpr-consents {
        margin: 24px 0;
        padding: 20px;
        background: ${isDark ? '#252525' : '#f9f9f9'};
        border-radius: 12px;
        border: 1px solid ${borderColor};
      }

      .syntera-gdpr-consent-item {
        display: flex;
        align-items: flex-start;
        padding: 12px 0;
        cursor: pointer;
        border-bottom: 1px solid ${borderColor};
      }

      .syntera-gdpr-consent-item:last-child {
        border-bottom: none;
      }

      .syntera-gdpr-consent-item input[type="checkbox"] {
        margin: 4px 12px 0 0;
        width: 18px;
        height: 18px;
        cursor: pointer;
        accent-color: ${primaryColor};
      }

      .syntera-gdpr-consent-item input[type="checkbox"]:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .syntera-gdpr-consent-label {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .syntera-gdpr-consent-label strong {
        font-size: 14px;
        font-weight: 600;
        color: ${textColor};
      }

      .syntera-gdpr-consent-desc {
        font-size: 12px;
        color: ${isDark ? '#a0a0a0' : '#666666'};
      }

      .syntera-gdpr-consent-required {
        opacity: 0.8;
      }

      .syntera-gdpr-footer {
        display: flex;
        gap: 16px;
        justify-content: center;
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid ${borderColor};
      }

      .syntera-gdpr-privacy-link {
        font-size: 12px;
        color: ${primaryColor};
        text-decoration: none;
        transition: opacity 0.2s;
      }

      .syntera-gdpr-privacy-link:hover {
        opacity: 0.8;
        text-decoration: underline;
      }

      .syntera-gdpr-actions {
        display: flex;
        gap: 12px;
        padding: 20px 24px;
        border-top: 1px solid ${borderColor};
        background: ${isDark ? '#1f1f1f' : '#fafafa'};
        border-radius: 0 0 16px 16px;
      }

      .syntera-gdpr-button {
        flex: 1;
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .syntera-gdpr-button-reject {
        background: ${isDark ? '#2a2a2a' : '#f0f0f0'};
        color: ${textColor};
        border: 1px solid ${borderColor};
      }

      .syntera-gdpr-button-reject:hover {
        background: ${isDark ? '#333333' : '#e0e0e0'};
      }

      .syntera-gdpr-button-accept {
        background: ${primaryColor};
        color: white;
      }

      .syntera-gdpr-button-accept:hover {
        background: ${primaryHover};
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      }

      @media (max-width: 640px) {
        .syntera-gdpr-content {
          width: 95%;
          max-height: 95vh;
        }

        .syntera-gdpr-title {
          font-size: 20px;
        }

        .syntera-gdpr-actions {
          flex-direction: column;
        }
      }
    `

    document.head.appendChild(style)
    document.body.appendChild(this.modal)

    // Attach event listeners
    this.attachEventListeners()
  }

  /**
   * Attach event listeners to consent modal
   */
  private attachEventListeners(): void {
    if (!this.modal) return

    const acceptBtn = this.modal.querySelector('#gdpr-accept')
    const rejectBtn = this.modal.querySelector('#gdpr-reject')
    const analyticsCheckbox = this.modal.querySelector('#consent-analytics') as HTMLInputElement
    const marketingCheckbox = this.modal.querySelector('#consent-marketing') as HTMLInputElement
    const processingCheckbox = this.modal.querySelector('#consent-processing') as HTMLInputElement

    acceptBtn?.addEventListener('click', () => {
      this.consentData = {
        necessary: true,
        analytics: analyticsCheckbox?.checked || false,
        marketing: marketingCheckbox?.checked || false,
        dataProcessing: processingCheckbox?.checked || false,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      }

      this.saveConsent()
      this.config.onConsent(this.consentData as ConsentData)
      this.hide()
    })

    rejectBtn?.addEventListener('click', () => {
      this.consentData = {
        necessary: true, // Always required
        analytics: false,
        marketing: false,
        dataProcessing: processingCheckbox?.checked || false, // Required for AI responses
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      }

      this.saveConsent()
      this.config.onConsent(this.consentData as ConsentData)
      this.hide()

      if (this.config.onReject) {
        this.config.onReject()
      }
    })

    // Prevent closing by clicking overlay (user must make a choice)
    const overlay = this.modal.querySelector('.syntera-gdpr-overlay')
    overlay?.addEventListener('click', (e) => {
      e.stopPropagation()
    })
  }

  /**
   * Save consent to localStorage
   */
  private saveConsent(): void {
    try {
      localStorage.setItem('syntera_gdpr_consent', JSON.stringify(this.consentData))
      localStorage.setItem('syntera_gdpr_consent_timestamp', new Date().toISOString())
    } catch (error) {
      // Silent fail for localStorage errors - not critical
      // Could use logger here if needed, but localStorage failures are usually non-critical
    }
  }

  /**
   * Load saved consent from localStorage
   */
  static loadConsent(): ConsentData | null {
    try {
      const consentStr = localStorage.getItem('syntera_gdpr_consent')
      const timestampStr = localStorage.getItem('syntera_gdpr_consent_timestamp')
      
      if (!consentStr || !timestampStr) {
        return null
      }

      // Check if consent is older than 1 year (GDPR recommends re-consent)
      const timestamp = new Date(timestampStr)
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

      if (timestamp < oneYearAgo) {
        // Consent expired, remove it
        localStorage.removeItem('syntera_gdpr_consent')
        localStorage.removeItem('syntera_gdpr_consent_timestamp')
        return null
      }

      return JSON.parse(consentStr) as ConsentData
    } catch (error) {
      // Silent fail for localStorage errors - not critical
      return null
    }
  }

  /**
   * Hide the consent modal
   */
  hide(): void {
    if (this.modal) {
      this.modal.remove()
      this.modal = null
    }
  }

  /**
   * Check if consent has been given
   */
  static hasConsent(): boolean {
    const consent = GDPRConsentModal.loadConsent()
    return consent !== null && consent.necessary === true
  }
}

