const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''
const KEY = process.env.NEXT_PUBLIC_API_KEY ?? ''

async function req<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
      ...(init?.headers ?? {}),
    },
  })
  if (res.status === 204) return undefined as T
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? res.statusText)
  return json as T
}

export const api = {
  status: () => req('/api/status'),
  logout: () => req('/api/status/logout', { method: 'POST' }),

  send: (chatId: string, message: string) =>
    req('/api/send', { method: 'POST', body: JSON.stringify({ chatId, message }) }),

  chats: {
    list: () => req('/api/chats'),
    messages: (id: string) => req(`/api/chats/${id}/messages`),
    update: (id: string, data: Record<string, unknown>) =>
      req(`/api/chats/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  contacts: {
    list: () => req('/api/contacts'),
    sync: () => req('/api/contacts/sync', { method: 'POST' }),
    create: (data: object) =>
      req('/api/contacts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: object) =>
      req(`/api/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      req(`/api/contacts/${id}`, { method: 'DELETE' }),
  },

  templates: {
    list: () => req('/api/templates'),
    create: (data: object) =>
      req('/api/templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: object) =>
      req(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      req(`/api/templates/${id}`, { method: 'DELETE' }),
  },

  blast: {
    list: () => req('/api/blast'),
    create: (data: object) =>
      req('/api/blast', { method: 'POST', body: JSON.stringify(data) }),
    start: (id: string) =>
      req(`/api/blast/${id}/start`, { method: 'POST' }),
    pause: (id: string) =>
      req(`/api/blast/${id}/pause`, { method: 'POST' }),
    recipients: (id: string) => req(`/api/blast/${id}/recipients`),
  },

  settings: {
    get: () => req('/api/settings'),
    update: (data: object) =>
      req('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },

  crm: {
    fields: {
      list: () => req('/api/crm/fields'),
      create: (data: object) =>
        req('/api/crm/fields', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: object) =>
        req(`/api/crm/fields/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (id: string) =>
        req(`/api/crm/fields/${id}`, { method: 'DELETE' }),
    },
    contacts: {
      list: () => req('/api/crm/contacts'),
      create: (data: object) =>
        req('/api/crm/contacts', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: object) =>
        req(`/api/crm/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (id: string) =>
        req(`/api/crm/contacts/${id}`, { method: 'DELETE' }),
      send: (id: string, data: { message?: string; template_id?: string }) =>
        req(`/api/crm/contacts/${id}/send`, { method: 'POST', body: JSON.stringify(data) }),
      import: (csv: string) =>
        req('/api/crm/contacts/import', { method: 'POST', body: JSON.stringify({ csv }) }),
      export: async (): Promise<string> => {
        const res = await fetch(`${BASE}/api/crm/contacts/export`, {
          headers: { Authorization: `Bearer ${KEY}` },
        })
        if (!res.ok) throw new Error('Export failed')
        return res.text()
      },
    },
  },
}
