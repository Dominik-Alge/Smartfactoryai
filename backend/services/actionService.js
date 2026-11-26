export function generateActionId(data) {

  if (!data._system) {
    data._system = {
      nextActionId: 1
    };
  }

  const id = `ACT-${String(
    data._system.nextActionId
  ).padStart(6, '0')}`;

  data._system.nextActionId++;

  return id;
}

export function createActionObject({
  title,
  description = '',
  panelId = null,
  machineId = null,
  criterion = null,
  creator = 'System'
}) {

  const now = new Date().toISOString();

  return {
    id: null,

    type: 'shopfloor',

    status: 'new',

    priority: 'normal',

    title,

    description,

    source: {
      panelId,
      machineId,
      criterion
    },

    creator,

    owner: null,

    createdAt: now,

    updatedAt: now,

    closedAt: null,

    comments: [],

    history: [
      {
        event: 'created',
        user: creator,
        timestamp: now
      }
    ]
  };
}

// ==========================================
// AB HIER: EBENE 2 - GEDÄCHTNIS & ENGINE
// ==========================================

// 1. Task erstellen und an ein bestehendes Action-Objekt hängen
export function assignTaskToAction(actionObject, { title, type, owner, dueDate, escalationLevel = 1 }) {
  // Falls die Engine-Struktur noch nicht existiert, initialisieren wir sie hier zukunftssicher
  if (!actionObject.engine) {
    actionObject.engine = {
      escalation: { currentLevel: 0, lastEscalatedAt: null },
      tasks: [],
      analysis: null,
      lessonsLearned: null
    };
  }

  // Generiere eine einfache Task-ID basierend auf der Anzahl der Tasks
  const taskId = `TSK-${String(actionObject.engine.tasks.length + 1).padStart(3, '0')}`;

  const newTask = {
    id: taskId,
    title,
    type,
    owner,
    dueDate: new Date(dueDate).toISOString(),
    status: 'open',
    escalationLevel
  };

  // Task in das Array schieben
  actionObject.engine.tasks.push(newTask);
  actionObject.updatedAt = new Date().toISOString();
  
  // Historie für das Audit-Log (dein Gedächtnis) fortschreiben
  actionObject.history.push({
    event: 'task_assigned',
    user: 'System',
    timestamp: actionObject.updatedAt,
    details: `Task ${taskId} ("${title}") zugewiesen an [${owner}]`
  });

  return actionObject;
}

// 2. Eskalationsstufe des Tickets erhöhen
export function escalateAction(actionObject, reason = "Fristüberschreitung") {
  if (!actionObject.engine) {
    actionObject.engine = { escalation: { currentLevel: 0, lastEscalatedAt: null }, tasks: [] };
  }

  actionObject.engine.escalation.currentLevel += 1;
  actionObject.engine.escalation.lastEscalatedAt = new Date().toISOString();
  actionObject.priority = 'high'; // Automatische Hochstufung der Priorität
  actionObject.updatedAt = actionObject.engine.escalation.lastEscalatedAt;

  actionObject.history.push({
    event: 'escalated',
    user: 'System',
    timestamp: actionObject.engine.escalation.lastEscalatedAt,
    details: `Eskaliert auf Stufe ${actionObject.engine.escalation.currentLevel}. Grund: ${reason}`
  });

  return actionObject;
}
