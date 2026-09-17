import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '@/lib/auth-context';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Toque numa notificação (app em background ou fechado) navega pra tela
    // relevante. Notificação recebida com app aberto já é tratada pelo
    // handler em src/lib/push-notifications.ts (só exibe o alerta).
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string } | undefined;
      if (data?.type === 'work_order_status') {
        router.push('/(tabs)/historico');
      } else if (data?.type === 'appointment_created' || data?.type === 'appointment_cancelled') {
        router.push('/(tabs)');
      }
    });
    return () => subscription.remove();
  }, [router]);

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthProvider>
  );
}
