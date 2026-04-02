export type Chat = {
  id: string
  name: string | null
  phone: string | null
  last_message: string | null
  last_message_at: string | null
  unread_count: number
  auto_reply_enabled: boolean
  created_at: string
}

export type Message = {
  id: string
  chat_id: string
  wa_message_id: string | null
  body: string
  direction: 'inbound' | 'outbound'
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
}

export type Contact = {
  id: string
  name: string
  phone: string
  status: string | null
  remark: string | null
  tags: string[]
  created_at: string
}

export type MessageTemplate = {
  id: string
  name: string
  body: string
  created_at: string
}

export type BlastCampaign = {
  id: string
  name: string
  template_id: string | null
  custom_message: string | null
  status: 'draft' | 'running' | 'paused' | 'completed' | 'failed'
  total_recipients: number
  sent_count: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  message_templates?: { name: string } | null
}

export type BlastRecipient = {
  id: string
  campaign_id: string
  contact_id: string
  status: 'pending' | 'sent' | 'failed'
  sent_at: string | null
  error_message: string | null
  contacts?: { name: string; phone: string } | null
}

export type Settings = {
  global_auto_reply: string
  [key: string]: string
}

export type ConnectionStatus = {
  status: 'connecting' | 'open' | 'close'
  qr: string | null
}

export type CrmField = {
  id: string
  name: string
  key: string
  type: 'text' | 'number' | 'date' | 'select' | 'boolean'
  options: string[]
  required: boolean
  sort_order: number
  created_at: string
}

export type CrmContact = {
  id: string
  name: string
  phone: string | null
  email: string | null
  custom_data: Record<string, string | number | boolean>
  created_at: string
  updated_at: string
}
