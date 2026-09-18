import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '@/lib/api-client';
import { colors, spacing, radius } from '@/lib/theme';
import type { Product } from '@/lib/types';

function formatCurrency(value: string | number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ProdutosScreen() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<Product[]>('/products');
      setProducts(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os produtos.');
    }
  }, []);

  // Recarrega ao focar a aba — cobre o caso de o estoque ter mudado (compra
  // feita em outro dispositivo, ou o próprio checkout desta tela).
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

  function setQuantity(productId: string, quantity: number, maxQuantity: number) {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(0, Math.min(quantity, maxQuantity)) }));
  }

  const cartItems = useMemo(() => {
    if (!products) return [];
    return Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([productId, quantity]) => {
        const product = products.find((item) => item.id === productId);
        return product ? { product, quantity } : null;
      })
      .filter((item): item is { product: Product; quantity: number } => item !== null);
  }, [quantities, products]);

  const total = cartItems.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);

  async function handleCheckout() {
    if (cartItems.length === 0) return;
    setError(null);
    setIsCheckingOut(true);
    try {
      // Não mandamos customerId: pro papel CUSTOMER o backend resolve a
      // partir do próprio token, e ignora qualquer customerId enviado por
      // um cliente — igual ao checkout do site.
      await api.post('/sales/checkout', {
        items: cartItems.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
      });
      setQuantities({});
      setDone(true);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível concluir a compra.');
    } finally {
      setIsCheckingOut(false);
    }
  }

  if (products === null) {
    return (
      <SafeAreaView style={styles.screen} edges={['left', 'right']}>
        <ActivityIndicator style={styles.loading} color={colors.navy} />
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView style={styles.screen} edges={['left', 'right']}>
        <View style={styles.doneBox}>
          <Text style={styles.doneTitle}>Compra confirmada!</Text>
          <Text style={styles.doneSubtitle}>
            Acompanhe o pagamento na tela de vendas assim que estiver disponível no app.
          </Text>
          <TouchableOpacity style={styles.doneButton} onPress={() => setDone(false)}>
            <Text style={styles.doneButtonText}>Continuar comprando</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.navy} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Produtos</Text>
            <Text style={styles.subtitle}>Peças e produtos disponíveis para compra</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nenhum produto disponível no momento.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const outOfStock = item.quantity <= 0;
          const quantity = quantities[item.id] ?? 0;
          return (
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {item.description && <Text style={styles.cardDescription}>{item.description}</Text>}
                <Text style={styles.cardPrice}>{formatCurrency(item.price)}</Text>
              </View>

              {outOfStock ? (
                <Text style={styles.outOfStock}>Indisponível</Text>
              ) : (
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => setQuantity(item.id, quantity - 1, item.quantity)}
                    disabled={quantity === 0}
                  >
                    <Text style={styles.stepperButtonText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{quantity}</Text>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => setQuantity(item.id, quantity + 1, item.quantity)}
                    disabled={quantity >= item.quantity}
                  >
                    <Text style={styles.stepperButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {cartItems.length > 0 && (
        <View style={styles.cartBar}>
          <View>
            <Text style={styles.cartCount}>{cartItems.length} item(ns) no carrinho</Text>
            <Text style={styles.cartTotal}>{formatCurrency(total)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.checkoutButton, isCheckingOut && styles.checkoutButtonDisabled]}
            onPress={handleCheckout}
            disabled={isCheckingOut}
          >
            {isCheckingOut ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.checkoutButtonText}>Finalizar compra</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  loading: { marginTop: spacing.xl },
  list: { padding: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
  header: { marginBottom: spacing.md },
  title: { fontSize: 20, fontWeight: '600', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.inkMuted, marginTop: spacing.xs },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { fontSize: 14, color: colors.inkMuted },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardInfo: { flex: 1, paddingRight: spacing.md },
  cardTitle: { fontSize: 15, fontWeight: '500', color: colors.ink },
  cardDescription: { fontSize: 13, color: colors.inkMuted, marginTop: spacing.xs },
  cardPrice: { fontSize: 14, fontWeight: '600', color: colors.navy, marginTop: spacing.xs, fontVariant: ['tabular-nums'] },
  outOfStock: { fontSize: 12, color: colors.danger },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: { fontSize: 16, color: colors.ink },
  stepperValue: { fontSize: 15, fontWeight: '600', color: colors.ink, minWidth: 20, textAlign: 'center' },
  errorBox: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: '#FBEAE9',
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  errorText: { color: colors.danger, fontSize: 13 },
  cartBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    padding: spacing.md,
  },
  cartCount: { fontSize: 12, color: colors.inkMuted },
  cartTotal: { fontSize: 17, fontWeight: '600', color: colors.navy, fontVariant: ['tabular-nums'] },
  checkoutButton: {
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  checkoutButtonDisabled: { opacity: 0.6 },
  checkoutButtonText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  doneBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  doneTitle: { fontSize: 18, fontWeight: '600', color: colors.success },
  doneSubtitle: { fontSize: 14, color: colors.inkMuted, marginTop: spacing.xs, textAlign: 'center' },
  doneButton: { marginTop: spacing.lg },
  doneButtonText: { color: colors.navy, fontWeight: '600', fontSize: 14 },
});
