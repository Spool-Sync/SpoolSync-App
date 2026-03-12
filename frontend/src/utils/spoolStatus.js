export const SPOOL_ORDER_STATUS_COLORS = {
  IN_STOCK:       'success',
  REORDER_NEEDED: 'warning',
  ORDERED:        'info',
  DELIVERED:      'success',
};

export function spoolStatusColor(status) {
  return SPOOL_ORDER_STATUS_COLORS[status] ?? 'default';
}
