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
