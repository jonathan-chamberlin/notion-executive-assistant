/**
 * EmailSkill - Email sending for Clawdbot
 *
 * This skill provides email functionality via SMTP.
 * All emails are logged for auditability.
 */

import nodemailer from 'nodemailer';

// Rate limiting state
const rateLimitState = {
  count: 0,
  windowStart: Date.now(),
  maxPerMinute: 10,
};

// Draft storage (in-memory, session-scoped)
let currentDraft = null;

/**
 * Validate email address format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate environment variables
 */
function validateEnv() {
  const errors = [];
  if (!process.env.SMTP_HOST) errors.push('SMTP_HOST is not set');
  if (!process.env.SMTP_PORT) errors.push('SMTP_PORT is not set');
  if (!process.env.SMTP_USER) errors.push('SMTP_USER is not set');
  if (!process.env.SMTP_PASS) errors.push('SMTP_PASS is not set');
  if (!process.env.EMAIL_FROM) errors.push('EMAIL_FROM is not set');
  return errors;
}

/**
 * Check rate limit
 */
function checkRateLimit() {
  const now = Date.now();
  const windowDuration = 60 * 1000; // 1 minute

  if (now - rateLimitState.windowStart > windowDuration) {
    // Reset window
    rateLimitState.count = 0;
    rateLimitState.windowStart = now;
  }

  if (rateLimitState.count >= rateLimitState.maxPerMinute) {
    const waitTime = Math.ceil((rateLimitState.windowStart + windowDuration - now) / 1000);
    return { allowed: false, waitTime };
  }

  return { allowed: true };
}

/**
 * Log an action for auditability
 */
function logAction(action, details) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    skill: 'EmailSkill',
    action,
    timestamp,
    ...details,
  }));
}

/**
 * Create SMTP transporter
 */
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send an email
 */
export async function sendEmail({ to, subject, body, cc, bcc, replyTo, force = false }) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  // Validate recipient
  if (!to) {
    return { success: false, error: 'Recipient (to) is required' };
  }

  const recipients = Array.isArray(to) ? to : [to];
  for (const email of recipients) {
    if (!isValidEmail(email)) {
      return { success: false, error: `Invalid email format: ${email}` };
    }
  }

  // Validate subject and body
  if (!subject || subject.trim().length === 0) {
    return { success: false, error: 'Subject is required' };
  }
  if (!body || body.trim().length === 0) {
    return { success: false, error: 'Email body is required' };
  }

  // Check rate limit
  const rateCheck = checkRateLimit();
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Rate limit exceeded. Try again in ${rateCheck.waitTime} seconds.`
    };
  }

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: recipients.join(', '),
      subject: subject.trim(),
      text: body.trim(),
    };

    if (cc) {
      const ccList = Array.isArray(cc) ? cc : [cc];
      mailOptions.cc = ccList.join(', ');
    }

    if (bcc) {
      const bccList = Array.isArray(bcc) ? bcc : [bcc];
      mailOptions.bcc = bccList.join(', ');
    }

    if (replyTo) {
      mailOptions.replyTo = replyTo;
    }

    const result = await transporter.sendMail(mailOptions);

    // Increment rate limit counter
    rateLimitState.count++;

    const emailRecord = {
      messageId: result.messageId,
      to: recipients,
      subject: subject.trim(),
      sentAt: new Date().toISOString(),
    };

    logAction('send', emailRecord);

    return {
      success: true,
      email: emailRecord,
    };
  } catch (error) {
    logAction('send_error', { to: recipients, subject, error: error.message });
    return {
      success: false,
      error: `Failed to send email: ${error.message}`
    };
  }
}

/**
 * Create a draft email for review
 */
export async function createDraft({ to, subject, body, cc, bcc }) {
  // Validate recipient
  if (!to) {
    return { success: false, error: 'Recipient (to) is required' };
  }

  const recipients = Array.isArray(to) ? to : [to];
  for (const email of recipients) {
    if (!isValidEmail(email)) {
      return { success: false, error: `Invalid email format: ${email}` };
    }
  }

  currentDraft = {
    to: recipients,
    subject: subject?.trim() || '',
    body: body?.trim() || '',
    cc: cc ? (Array.isArray(cc) ? cc : [cc]) : null,
    bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : null,
    createdAt: new Date().toISOString(),
  };

  logAction('draft_created', { to: recipients, subject });

  return {
    success: true,
    draft: currentDraft,
    message: 'Draft created. Use /email confirm to send or /email cancel to discard.',
  };
}

/**
 * Confirm and send the current draft
 */
export async function confirmDraft() {
  if (!currentDraft) {
    return { success: false, error: 'No draft to send. Create a draft first with /email draft.' };
  }

  const result = await sendEmail({
    to: currentDraft.to,
    subject: currentDraft.subject,
    body: currentDraft.body,
    cc: currentDraft.cc,
    bcc: currentDraft.bcc,
    force: true,
  });

  if (result.success) {
    currentDraft = null;
  }

  return result;
}

/**
 * Cancel the current draft
 */
export async function cancelDraft() {
  if (!currentDraft) {
    return { success: false, error: 'No draft to cancel.' };
  }

  const cancelled = { ...currentDraft };
  currentDraft = null;

  logAction('draft_cancelled', { to: cancelled.to, subject: cancelled.subject });

  return {
    success: true,
    message: 'Draft cancelled.',
    cancelled,
  };
}

/**
 * Get the current draft
 */
export async function getDraft() {
  if (!currentDraft) {
    return { success: true, draft: null, message: 'No active draft.' };
  }
  return { success: true, draft: currentDraft };
}

/**
 * Send a quick reply using a template
 */
export async function sendTemplateReply({ template, to, context = {} }) {
  const templates = {
    ack: {
      subject: 'Re: Received',
      body: `Thank you for your message. I've received it and will get back to you shortly.\n\nBest regards`,
    },
    followup: {
      subject: 'Following Up',
      body: `I wanted to follow up on our previous conversation. Please let me know if you have any updates or if there's anything else you need from me.\n\nBest regards`,
    },
    thanks: {
      subject: 'Thank You',
      body: `Thank you for your help and support. I really appreciate it.\n\nBest regards`,
    },
    decline: {
      subject: 'Re: Your Request',
      body: `Thank you for reaching out. Unfortunately, I won't be able to accommodate this request at this time. I appreciate your understanding.\n\nBest regards`,
    },
  };

  if (!templates[template]) {
    return {
      success: false,
      error: `Unknown template: ${template}. Available: ${Object.keys(templates).join(', ')}`
    };
  }

  const { subject, body } = templates[template];

  return sendEmail({
    to,
    subject: context.subject ? `Re: ${context.subject}` : subject,
    body: context.senderName ? body.replace('Best regards', `Best regards,\n${context.senderName}`) : body,
  });
}

// Default export for Clawdbot skill registration
export default {
  name: 'EmailSkill',
  description: 'Send and manage emails via SMTP',
  functions: {
    sendEmail,
    createDraft,
    confirmDraft,
    cancelDraft,
    getDraft,
    sendTemplateReply,
  },
};
