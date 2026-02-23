import { computed } from 'vue';
import { useAuthStore } from '@/store/auth';

export function useFavoriteBrands() {
  const authStore = useAuthStore();
  const favoriteBrands = computed(() => new Set(authStore.preferences.favoriteBrands));

  function toggleFavorite(brand) {
    const current = new Set(authStore.preferences.favoriteBrands);
    if (current.has(brand)) current.delete(brand);
    else current.add(brand);
    authStore.updatePreferences({ favoriteBrands: [...current] });
  }

  return { favoriteBrands, toggleFavorite };
}
