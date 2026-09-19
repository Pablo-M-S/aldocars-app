import type { ComponentProps } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// iconKey vem do backend (Service.iconKey) — mantemos o mapeamento aqui,
// e não em texto livre, pra garantir que só nomes de ícone válidos do
// MaterialCommunityIcons cheguem ao componente. Uma chave desconhecida ou
// nula cai no ícone genérico (FALLBACK_ICON) em vez de quebrar a tela.
const ICON_MAP: Record<string, IconName> = {
  'clipboard-text-search-outline': 'clipboard-text-search-outline',
  'hammer-wrench': 'hammer-wrench',
  'car-door': 'car-door',
  spray: 'spray',
  'format-paint': 'format-paint',
  'vector-line': 'vector-line',
  'car-wash': 'car-wash',
  wrench: 'wrench',
};

const FALLBACK_ICON: IconName = 'car-cog';

export function getServiceIconName(iconKey: string | null | undefined): IconName {
  if (!iconKey) return FALLBACK_ICON;
  return ICON_MAP[iconKey] ?? FALLBACK_ICON;
}

export { MaterialCommunityIcons };
