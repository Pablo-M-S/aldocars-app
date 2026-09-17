import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '@/lib/auth-context';

function routeForNotification(data: { type?: string } | undefined): '/(tabs)/historico' | '/(tabs)' | null {
  if (data?.type === 'work_order_status') return '/(tabs)/historico';
  if (data?.type === 'appointment_created' || data?.type === 'appointment_cancelled') return '/(tabs)';
  return null;
}

/**
 * Fica dentro do AuthProvider de propósito: navegar por causa de uma
 * notificação só faz sentido depois que sabemos se há sessão — do
 * contrário a guarda de rota das abas (ver (tabs)/_layout.tsx) briga com
 * este redirect e manda de volta pro login no meio do caminho.
 */
function NotificationRouter() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  // Guarda o id da última notificação já tratada — getLastNotificationResponseAsync
  // devolve a MESMA resposta em toda chamada até ela ser limpa; sem essa
  // trava, reabrir o app depois de já ter navegado por ela navegaria de
  // novo (ex.: um segundo useEffect, hot reload em dev, etc.).
  const handledNotificationId = useRef<string | null>(null);
  // Se a notificação de cold start chegar antes de sabermos se há sessão,
  // guardamos pra aplicar assim que `user` resolver — sem isso, o toque
  // que abriu o app do zero simplesmente se perde.
  const pendingData = useRef<{ type?: string } | null>(null);

  function handle(notificationId: string, data: { type?: string } | undefined) {
    if (handledNotificationId.current === notificationId) return;
    handledNotificationId.current = notificationId;

    if (!user) {
      pendingData.current = data ?? null;
      return;
    }
    const route = routeForNotification(data);
    if (route) router.push(route);
  }

  // Cold start: app foi aberto (do zero, não só trazido de background) por
  // um toque em notificação. addNotificationResponseReceivedListener sozinho
  // não cobre esse caso em todas as plataformas — por isso os dois.
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as { type?: string } | undefined;
      handle(response.notification.request.identifier, data);
    });
  }, []);

  // App já aberto (foreground ou trazido de background) e o usuário toca
  // numa notificação nova.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string } | undefined;
      handle(response.notification.request.identifier, data);
    });
    return () => subscription.remove();
  }, [user]);

  // A sessão só resolve depois do cold start acima, então aplicamos aqui o
  // que ficou pendente assim que soubermos que há usuário logado.
  useEffect(() => {
    if (!isLoading && user && pendingData.current) {
      const route = routeForNotification(pendingData.current);
      pendingData.current = null;
      if (route) router.push(route);
    }
  }, [isLoading, user, router]);

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationRouter />
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthProvider>
  );
}
