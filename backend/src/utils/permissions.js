export const PERMISSION_GROUPS = [
  {
    group: 'spools',
    label: 'Filament Spools',
    permissions: ['spools:view', 'spools:create', 'spools:edit', 'spools:delete'],
  },
  {
    group: 'filament_types',
    label: 'Filament Types',
    permissions: [
      'filament_types:view',
      'filament_types:create',
      'filament_types:edit',
      'filament_types:delete',
    ],
  },
  {
    group: 'printers',
    label: 'Printers',
    permissions: ['printers:view', 'printers:create', 'printers:edit', 'printers:delete'],
  },
  {
    group: 'orders',
    label: 'Orders',
    permissions: ['orders:view', 'orders:create', 'orders:edit', 'orders:delete'],
  },
  {
    group: 'storage',
    label: 'Storage',
    permissions: ['storage:view', 'storage:create', 'storage:edit', 'storage:delete'],
  },
  {
    group: 'spool_holders',
    label: 'Spool Holders',
    permissions: [
      'spool_holders:view',
      'spool_holders:create',
      'spool_holders:edit',
      'spool_holders:delete',
    ],
  },
  {
    group: 'esp32_devices',
    label: 'ESP32 Devices',
    permissions: [
      'esp32_devices:view',
      'esp32_devices:create',
      'esp32_devices:edit',
      'esp32_devices:delete',
    ],
  },
  {
    group: 'users',
    label: 'Users',
    permissions: ['users:view', 'users:create', 'users:edit', 'users:delete'],
  },
  {
    group: 'roles',
    label: 'Roles',
    permissions: ['roles:view', 'roles:create', 'roles:edit', 'roles:delete'],
  },
  {
    group: 'settings',
    label: 'Settings',
    permissions: ['settings:view', 'settings:edit'],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.permissions);
