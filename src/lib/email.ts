import nodemailer from 'nodemailer'

type SendMailArgs = {
  to: string
  subject: string
  text: string
  html?: string
}

let cachedTransport: nodemailer.Transporter | null = null

function getTransport() {
  if (cachedTransport) return cachedTransport

  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || '587')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error('SMTP 환경변수가 설정되지 않았어요 (SMTP_HOST/SMTP_USER/SMTP_PASS)')
  }

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
  return cachedTransport
}

export async function sendMail({ to, subject, text, html }: SendMailArgs) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER
  if (!from) throw new Error('SMTP_FROM 또는 SMTP_USER가 필요해요')

  const transport = getTransport()
  await transport.sendMail({
    from,
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  })
}

