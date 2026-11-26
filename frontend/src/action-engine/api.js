// =========================================================================
// API – alle Server-Aufrufe der Action Engine an einer Stelle
// -------------------------------------------------------------------------
// Jede Funktion liefert die Antwort des Servers oder wirft einen Fehler
// mit dem Klartext, den der Server zurückgibt.
// =========================================================================

const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

async function request(method, path, body) {
  const response = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Fehler ${response.status}`);
  return data;
}

export const api = {
  config: () => request('GET', '/action-config'),
  tickets: () => request('GET', '/tickets'),
  calendars: () => request('GET', '/calendars'),
  outbox: () => request('GET', '/outbox'),

  editTicket: (id, fields, author) => request('PATCH', `/ticket/${id}`, { ...fields, author }),
  nextPhase: (id, author) => request('POST', `/ticket/${id}/phase`, { direction: 'next', author }),
  previousPhase: (id, author) => request('POST', `/ticket/${id}/phase`, { direction: 'back', author }),
  effectiveness: (id, result, note, author) => request('POST', `/ticket/${id}/effectiveness`, { result, note, author }),

  addTask: (id, task, author) => request('POST', `/ticket/${id}/task`, { ...task, author }),
  toggleTask: (id, taskId, author) => request('POST', `/ticket/${id}/task/${taskId}/toggle`, { author }),
  removeTask: (id, taskId, author) => request('DELETE', `/ticket/${id}/task/${taskId}`, { author }),

  escalate: (id, reason, author) => request('POST', `/ticket/${id}/escalate`, { reason, author }),
  deEscalate: (id, reason, author) => request('POST', `/ticket/${id}/de-escalate`, { reason, author }),
  dismissEscalation: (id, reason, author) => request('POST', `/ticket/${id}/escalation/dismiss`, { reason, author }),

  setMachineCalendar: (panelId, machineId, calendarId) =>
    request('PUT', `/panel/${panelId}/machine-calendar`, { machineId, calendarId })
};
