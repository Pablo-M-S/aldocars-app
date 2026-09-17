import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api, ApiError } from './api-client';

// Como a notificação aparece com o app aberto em primeiro plano — sem isso,
// o padrão do expo-notifications é não mostrar nada nesse caso.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function resolveProjectId(): string | undefined {
  // Antes de rodar `eas build:configure` (próximo passo do projeto, ver
  // README), não existe projectId — getExpoPushTokenAsync funciona sem ele
  // no Expo Go. Depois que o EAS for configurado, app.json passa a ter
  // extra.eas.projectId automaticamente e este código já usa, sem precisar
  // mudar nada aqui.
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    // Emulador/simulador não recebe push de verdade.
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  const projectId = resolveProjectId();
  const result = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return result.data;
}

/**
 * Chamado após login e ao restaurar uma sessão já existente. Silencioso de
 * propósito: registro de push nunca deve travar ou avisar sobre erro no
 * fluxo de login — o app funciona normalmente sem notificações, só perde a
 * funcionalidade neste aparelho.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    const token = await getExpoPushToken();
    if (!token) return;
    await api.post('/notifications/device-token', { token, platform: Platform.OS });
  } catch (err) {
    if (!(err instanceof ApiError)) {
      console.warn('Não foi possível registrar notificações push:', err);
    }
  }
}

/**
 * Chamado no logout, enquanto o token de sessão ainda é válido (precisa
 * estar autenticado pra apagar o próprio device token). Também silencioso:
 * uma falha aqui não pode impedir o usuário de sair da conta.
 */
export async function unregisterCurrentDevicePushToken(): Promise<void> {
  try {
    const token = await getExpoPushToken();
    if (!token) return;
    await api.delete('/notifications/device-token', { token });
  } catch {
    // Sem sorte desta vez — o token fica órfão no backend até o Expo Push
    // API reportar "DeviceNotRegistered" numa tentativa futura, quando o
    // NotificationsService do backend já limpa sozinho.
  }
}
