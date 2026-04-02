import { supabase } from './supabase'
import { sendMessage } from '../whatsapp/connection'

interface QueueItem {
  campaignId: string
  recipientId: string
  contactId: string
  phone: string
  message: string
}

const queue: QueueItem[] = []
let processing = false
let intervalHandle: NodeJS.Timeout | null = null

const BLAST_INTERVAL_MS = parseInt(process.env.BLAST_INTERVAL_MS || '120000', 10)

export function startBlastQueue() {
  if (intervalHandle) return
  intervalHandle = setInterval(processNext, BLAST_INTERVAL_MS)
  console.log(`Blast queue started — interval ${BLAST_INTERVAL_MS}ms`)
}

export async function enqueueCampaign(campaignId: string) {
  const { data: campaign } = await supabase
    .from('blast_campaigns')
    .select('custom_message, template_id, message_templates(body)')
    .eq('id', campaignId)
    .single()

  if (!campaign) throw new Error('Campaign not found')

  const messageTemplate =
    campaign.custom_message ||
    (Array.isArray(campaign.message_templates) ? campaign.message_templates[0] : campaign.message_templates as { body: string } | null)?.body

  if (!messageTemplate) throw new Error('Campaign has no message')

  const { data: recipients } = await supabase
    .from('blast_recipients')
    .select('id, contact_id, contacts(name, phone)')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')

  if (!recipients?.length) return

  for (const r of recipients) {
    const contact = (Array.isArray(r.contacts) ? r.contacts[0] : r.contacts) as { name: string; phone: string } | null
    if (!contact) continue

    const message = messageTemplate
      .replace(/\{\{name\}\}/g, contact.name)
      .replace(/\{\{phone\}\}/g, contact.phone)

    queue.push({
      campaignId,
      recipientId: r.id,
      contactId: r.contact_id,
      phone: contact.phone,
      message,
    })
  }

  await supabase
    .from('blast_campaigns')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', campaignId)
}

export async function pauseCampaign(campaignId: string) {
  // Remove queued items for this campaign
  const removed = queue.filter(i => i.campaignId === campaignId).length
  queue.splice(0, queue.length, ...queue.filter(i => i.campaignId !== campaignId))

  await supabase
    .from('blast_campaigns')
    .update({ status: 'paused' })
    .eq('id', campaignId)

  return removed
}

async function processNext() {
  if (processing || queue.length === 0) return
  processing = true

  const item = queue.shift()!

  try {
    // Look up the actual JID from chats table (may be @lid format)
    const { data: existingChat } = await supabase
      .from('chats')
      .select('id')
      .eq('phone', item.phone)
      .maybeSingle()

    const jid = existingChat?.id ?? (item.phone.replace('+', '') + '@s.whatsapp.net')
    await sendMessage(jid, item.message)

    const timestamp = new Date().toISOString()

    // Upsert chat row and save message so it appears in the chat UI
    await supabase.from('chats').upsert(
      { id: jid, phone: item.phone, last_message: item.message, last_message_at: timestamp },
      { onConflict: 'id' }
    )
    await supabase.from('messages').insert({
      chat_id: jid,
      body: item.message,
      direction: 'outbound',
      status: 'sent',
      timestamp,
    })

    await supabase
      .from('blast_recipients')
      .update({ status: 'sent', sent_at: timestamp })
      .eq('id', item.recipientId)

    const { count: sentCount } = await supabase
      .from('blast_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', item.campaignId)
      .eq('status', 'sent')

    await supabase
      .from('blast_campaigns')
      .update({ sent_count: sentCount ?? 0 })
      .eq('id', item.campaignId)
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    await supabase
      .from('blast_recipients')
      .update({ status: 'failed', error_message: error })
      .eq('id', item.recipientId)
  } finally {
    processing = false
    await checkCampaignCompletion(item.campaignId)
  }
}

async function checkCampaignCompletion(campaignId: string) {
  const stillPending = queue.some(i => i.campaignId === campaignId)
  if (stillPending) return

  const { count } = await supabase
    .from('blast_recipients')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')

  if (count === 0) {
    await supabase
      .from('blast_campaigns')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', campaignId)
  }
}
