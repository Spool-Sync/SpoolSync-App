export const STORAGE_TYPES = {
  DRYER: {
    label: 'Dryer',
    icon: 'mdi-hair-dryer',
    color: 'orange',
  },
  LONG_TERM_STORAGE: {
    label: 'Long-term Storage',
    icon: 'mdi-archive',
    color: 'blue',
  },
  OPEN_SHELF: {
    label: 'Open Shelf',
    icon: 'mdi-bookshelf',
    color: 'green',
  },
  OTHER: {
    label: 'Other',
    icon: 'mdi-package-variant',
    color: 'grey',
  },
};

export function storageTypeInfo(type) {
  return STORAGE_TYPES[type] ?? { label: type, icon: 'mdi-package-variant', color: 'grey' };
}
