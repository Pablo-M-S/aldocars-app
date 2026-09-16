import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { colors, spacing, radius } from '@/lib/theme';
import type { Appointment, CustomerMe } from '@/lib/types';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const UPCOMING_STATUSES = new Set(['SCHEDULED', 'CONFIRMED']);

export default function InicioScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const me = await api.get<CustomerMe>('/customers/me');
      const data = await api.get<Appointment[]>(`/appointments/by-customer/${me.id}`);
      setAppointments(data.filter((appointment) => UPCOMING_STATUSES.has(appointment.status)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar seus agendamentos.');
    }
  }, []);

  // Recarrega toda vez que a aba ganha foco — cobre o caso de o usuário
  // agendar algo na aba "Agendar" e voltar pra "Início" sem sair do app.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  function confirmCancel(id: string) {
    Alert.alert('Cancelar agendamento', 'Tem certeza que deseja cancelar?', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Cancelar agendamento', style: 'destructive', onPress: () => handleCancel(id) },
    ]);
  }

  async function handleCancel(id: string) {
    setCancellingId(id);
    try {
      await api.delete(`/appointments/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível cancelar o agendamento.');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Olá, {user?.email.split('@')[0]}</Text>
        <Text style={styles.subtitle}>Seus próximos agendamentos</Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {appointments === null ? (
        <ActivityIndicator style={styles.loading} color={colors.navy} />
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item: Appointment) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.navy} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Nenhum agendamento por vir.</Text>
              <Text style={styles.emptyLink} onPress={() => router.push('/(tabs)/agendar')}>
                Agendar um serviço →
              </Text>
            </View>
          }
          renderItem={({ item }: { item: Appointment }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardTitle}>{item.service.name}</Text>
                  <Text style={styles.cardSubtitle}>
                    {formatDateTime(item.startsAt)} · {item.vehicle.plate}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => confirmCancel(item.id)} disabled={cancellingId === item.id}>
                  <Text style={styles.cancelLink}>
                    {cancellingId === item.id ? 'Cancelando…' : 'Cancelar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  greeting: { fontSize: 20, fontWeight: '600', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.inkMuted, marginTop: spacing.xs },
  loading: { marginTop: spacing.xl },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
  card: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cancelLink: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  cardTitle: { fontSize: 15, fontWeight: '500', color: colors.ink },
  cardSubtitle: { fontSize: 13, color: colors.inkMuted, marginTop: spacing.xs, fontVariant: ['tabular-nums'] },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { fontSize: 14, color: colors.inkMuted },
  emptyLink: { fontSize: 14, color: colors.navy, fontWeight: '600', marginTop: spacing.sm },
  errorBox: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: '#FBEAE9',
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  errorText: { color: colors.danger, fontSize: 13 },
});
