import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { api, ApiError } from '@/lib/api-client';
import { colors, spacing, radius } from '@/lib/theme';
import type { CustomerMe, Sale, WorkOrder } from '@/lib/types';

function formatCurrency(value: string | number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const WORK_ORDER_STATUS: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Aberta', color: colors.navy },
  DIAGNOSING: { label: 'Em diagnóstico', color: colors.navy },
  AWAITING_APPROVAL: { label: 'Aguardando sua aprovação', color: colors.warning },
  IN_PROGRESS: { label: 'Em execução', color: colors.warning },
  AWAITING_PARTS: { label: 'Aguardando peça', color: colors.warning },
  COMPLETED: { label: 'Concluída', color: colors.success },
  CANCELLED: { label: 'Cancelada', color: colors.danger },
  DELIVERED: { label: 'Entregue', color: colors.success },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Dinheiro',
  DEBIT_CARD: 'Cartão de débito',
  CREDIT_CARD: 'Cartão de crédito',
  PIX: 'Pix',
  BANK_TRANSFER: 'Transferência',
};

type Tab = 'ordens' | 'pagamentos';

export default function HistoricoScreen() {
  const [tab, setTab] = useState<Tab>('ordens');
  const [workOrders, setWorkOrders] = useState<WorkOrder[] | null>(null);
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const me = await api.get<CustomerMe>('/customers/me');
      const [workOrdersData, salesData] = await Promise.all([
        api.get<WorkOrder[]>(`/work-orders/by-customer/${me.id}`),
        api.get<Sale[]>(`/sales/by-customer/${me.id}`),
      ]);
      setWorkOrders(workOrdersData);
      setSales(salesData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar seu histórico.');
    }
  }, []);

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

  const isLoading = workOrders === null || sales === null;

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Histórico</Text>
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segmentButton, tab === 'ordens' && styles.segmentButtonActive]}
            onPress={() => setTab('ordens')}
          >
            <Text style={[styles.segmentText, tab === 'ordens' && styles.segmentTextActive]}>
              Ordens de serviço
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, tab === 'pagamentos' && styles.segmentButtonActive]}
            onPress={() => setTab('pagamentos')}
          >
            <Text style={[styles.segmentText, tab === 'pagamentos' && styles.segmentTextActive]}>
              Pagamentos
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.navy} />
      ) : tab === 'ordens' ? (
        <FlatList
          data={workOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.navy} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Você ainda não tem nenhuma ordem de serviço.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const status = WORK_ORDER_STATUS[item.status] ?? { label: item.status, color: colors.navy };
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
                  <Text style={[styles.badge, { color: status.color }]}>{status.label}</Text>
                </View>
                {item.diagnosis && <Text style={styles.diagnosis}>{item.diagnosis}</Text>}
                {item.items.length > 0 && (
                  <View style={styles.itemsList}>
                    {item.items.map((line) => (
                      <View key={line.id} style={styles.itemRow}>
                        <Text style={styles.itemLabel} numberOfLines={1}>
                          {line.quantity}× {line.service?.name ?? line.product?.name ?? 'Item'}
                        </Text>
                        <Text style={styles.itemValue}>{formatCurrency(line.unitPrice)}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.cardFooter}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{formatCurrency(item.totalCost)}</Text>
                </View>
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.navy} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Você ainda não tem nenhuma compra registrada.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const paid = item.payments
              .filter((payment) => payment.status === 'PAID' || payment.status === 'PARTIALLY_PAID')
              .reduce((sum, payment) => sum + Number(payment.amount), 0);
            const remaining = Number(item.totalAmount) - paid;
            const isFullyPaid = remaining <= 0;

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
                  <Text style={[styles.badge, { color: isFullyPaid ? colors.success : colors.warning }]}>
                    {isFullyPaid ? 'Quitada' : `Saldo: ${formatCurrency(remaining)}`}
                  </Text>
                </View>
                {item.items.length > 0 && (
                  <View style={styles.itemsList}>
                    {item.items.map((line) => (
                      <View key={line.id} style={styles.itemRow}>
                        <Text style={styles.itemLabel} numberOfLines={1}>
                          {line.quantity}× {line.product.name}
                        </Text>
                        <Text style={styles.itemValue}>{formatCurrency(line.unitPrice)}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {item.payments.length > 0 && (
                  <View style={styles.paymentsList}>
                    {item.payments.map((payment) => (
                      <Text key={payment.id} style={styles.paymentLine}>
                        {formatCurrency(payment.amount)} via{' '}
                        {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                        {payment.paidAt ? ` em ${formatDate(payment.paidAt)}` : ''}
                      </Text>
                    ))}
                  </View>
                )}
                <View style={styles.cardFooter}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{formatCurrency(item.totalAmount)}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  title: { fontSize: 20, fontWeight: '600', color: colors.ink, marginBottom: spacing.md },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 2,
  },
  segmentButton: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm },
  segmentButtonActive: { backgroundColor: colors.navy },
  segmentText: { fontSize: 12, fontWeight: '600', color: colors.inkMuted },
  segmentTextActive: { color: colors.white },
  loading: { marginTop: spacing.xl },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { fontSize: 14, color: colors.inkMuted, textAlign: 'center' },
  card: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontSize: 13, color: colors.inkMuted },
  badge: { fontSize: 12, fontWeight: '600' },
  diagnosis: { fontSize: 14, color: colors.ink, marginTop: spacing.sm },
  itemsList: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  itemLabel: { fontSize: 13, color: colors.inkMuted, flex: 1, paddingRight: spacing.sm },
  itemValue: { fontSize: 13, color: colors.inkMuted, fontVariant: ['tabular-nums'] },
  paymentsList: { marginTop: spacing.sm },
  paymentLine: { fontSize: 12, color: colors.inkMuted, marginBottom: 2 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
  },
  totalLabel: { fontSize: 13, fontWeight: '500', color: colors.ink },
  totalValue: { fontSize: 14, fontWeight: '600', color: colors.navy, fontVariant: ['tabular-nums'] },
  errorBox: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: '#FBEAE9',
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  errorText: { color: colors.danger, fontSize: 13 },
});
