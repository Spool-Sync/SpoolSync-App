export const ASSIGNMENT_TYPE_META = {
  PRINTER:     { color: 'blue',   icon: 'mdi-printer-3d',       label: 'Printer' },
  STORAGE:     { color: 'green',  icon: 'mdi-archive',           label: 'Storage' },
  INGEST_POINT:{ color: 'orange', icon: 'mdi-tray-arrow-down',   label: 'Ingest Point' },
};

export function assignmentColor(type) { return ASSIGNMENT_TYPE_META[type]?.color ?? 'default'; }
export function assignmentIcon(type)  { return ASSIGNMENT_TYPE_META[type]?.icon  ?? 'mdi-help'; }
export function assignmentLabel(type) { return ASSIGNMENT_TYPE_META[type]?.label ?? type; }
