/**
 * Email Service
 * Handles sending emails via external service
 */

import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service:email')

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
}

/**
 * Send email via configured email service
 * Currently supports:
 * - Resend
 * - SendGrid
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const emailProvider = process.env.EMAIL_PROVIDER || 'resend'
  const fromEmail = options.from || process.env.EMAIL_FROM || 'noreply@syntera.ai'

  try {
    switch (emailProvider) {
      case 'resend':
        await sendViaResend({ ...options, from: fromEmail })
        break
      case 'sendgrid':
        await sendViaSendGrid({ ...options, from: fromEmail })
        break
      default:
        logger.warn('Unknown email provider, using Resend', { provider: emailProvider })
        await sendViaResend({ ...options, from: fromEmail })
    }

    logger.info('Email sent successfully', {
      to: options.to,
      subject: options.subject,
      provider: emailProvider,
    })
  } catch (error: any) {
    logger.error('Failed to send email', {
      error: error?.message,
      to: options.to,
      provider: emailProvider,
    })
    throw error
  }
}

/**
 * Send email via Resend
 */
async function sendViaResend(options: EmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Resend API error: ${error}`)
  }
}

/**
 * Send email via SendGrid
 */
async function sendViaSendGrid(options: EmailOptions): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY environment variable is not set')
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: options.to }],
        },
      ],
      from: { email: options.from },
      subject: options.subject,
      content: [
        {
          type: 'text/html',
          value: options.html,
        },
        ...(options.text ? [{
          type: 'text/plain',
          value: options.text,
        }] : []),
      ],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`SendGrid API error: ${error}`)
  }
}






