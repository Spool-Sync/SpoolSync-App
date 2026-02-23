export const PRINTER_STATUS_META = {
  OPERATIONAL: { color: 'success', icon: 'mdi-check-circle', defaultLabel: 'Operational' },
  PRINTING:    { color: 'primary', icon: 'mdi-printer-3d-nozzle', defaultLabel: 'Printing' },
  PAUSED:      { color: 'warning', icon: 'mdi-pause-circle', defaultLabel: 'Paused' },
  ERROR:       { color: 'error',   icon: 'mdi-alert-circle', defaultLabel: 'Error' },
  OFFLINE:     { color: 'default', icon: 'mdi-power-off', defaultLabel: 'Offline' },
  UNKNOWN:     { color: 'default', icon: 'mdi-help-circle', defaultLabel: 'Unknown' },
};

export function statusMeta(status) {
  return PRINTER_STATUS_META[status] ?? PRINTER_STATUS_META.UNKNOWN;
}

/**
 * Returns the human-readable label for a printer status.
 * Uses integration-specific labels (from the integration JSON's status_display_labels)
 * when available, falling back to built-in defaults.
 *
 * @param {string} status - Canonical status (OPERATIONAL, PRINTING, …)
 * @param {object|null} integrationType - Integration type object from the store (may be null)
 */
export function statusLabel(status, integrationType) {
  const custom = integrationType?.statusDisplayLabels?.[status];
  if (custom) return custom;
  return statusMeta(status).defaultLabel;
}
