import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { colors, spacing, radius } from '@/lib/theme';
import type { CustomerMe } from '@/lib/types';

export default function ContaScreen() {
  const { logout } = useAuth();
  const [me, setMe] = useState<CustomerMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showVehicleForm, setShowVehicleForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<CustomerMe>('/customers/me');
      setMe(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar sua conta.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!me) {
    return (
      <SafeAreaView style={styles.screen} edges={['left', 'right']}>
        <ActivityIndicator style={styles.loading} color={colors.navy} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>Nome</Text>
          <Text style={styles.value}>{me.user.name}</Text>
          <Text style={styles.label}>E-mail</Text>
          <Text style={styles.value}>{me.user.email}</Text>
          <Text style={styles.label}>Telefone</Text>
          <Text style={styles.value}>{me.phone ?? 'Não informado'}</Text>
        </View>

        <Text style={styles.sectionTitle}>Meus veículos</Text>
        {me.vehicles.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum veículo cadastrado.</Text>
        ) : (
          me.vehicles.map((vehicle) => (
            <View key={vehicle.id} style={styles.vehicleCard}>
              <Text style={styles.vehiclePlate}>{vehicle.plate}</Text>
              <Text style={styles.vehicleModel}>
                {vehicle.brand} {vehicle.model} · {vehicle.year}
              </Text>
            </View>
          ))
        )}

        {showVehicleForm ? (
          <NewVehicleForm
            onDone={() => {
              setShowVehicleForm(false);
              load();
            }}
            onCancel={() => setShowVehicleForm(false)}
          />
        ) : (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowVehicleForm(true)}>
            <Text style={styles.secondaryButtonText}>+ Adicionar veículo</Text>
          </TouchableOpacity>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
          <Text style={styles.logoutButtonText}>Sair</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function NewVehicleForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [plate, setPlate] = useState('');
  const [mileage, setMileage] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/vehicles', {
        brand,
        model,
        year: Number(year),
        plate: plate.toUpperCase(),
        mileage: Number(mileage),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível cadastrar o veículo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.formCard}>
      <Text style={styles.formLabel}>Marca</Text>
      <TextInput style={styles.input} value={brand} onChangeText={setBrand} />
      <Text style={styles.formLabel}>Modelo</Text>
      <TextInput style={styles.input} value={model} onChangeText={setModel} />
      <Text style={styles.formLabel}>Ano</Text>
      <TextInput style={styles.input} value={year} onChangeText={setYear} keyboardType="number-pad" />
      <Text style={styles.formLabel}>Placa</Text>
      <TextInput style={styles.input} value={plate} onChangeText={setPlate} autoCapitalize="characters" placeholder="ABC1D23" />
      <Text style={styles.formLabel}>Quilometragem</Text>
      <TextInput style={styles.input} value={mileage} onChangeText={setMileage} keyboardType="number-pad" />

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.formActions}>
        <TouchableOpacity
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Salvar</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg },
  loading: { marginTop: spacing.xl },
  card: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  label: { fontSize: 11, fontWeight: '500', color: colors.inkMuted, marginTop: spacing.sm },
  value: { fontSize: 15, color: colors.ink, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.inkMuted, marginBottom: spacing.md },
  vehicleCard: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  vehiclePlate: { fontSize: 14, fontWeight: '600', color: colors.ink },
  vehicleModel: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  secondaryButton: { paddingVertical: spacing.sm, marginTop: spacing.xs },
  secondaryButtonText: { color: colors.navy, fontWeight: '600', fontSize: 14 },
  formCard: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  formLabel: { fontSize: 12, fontWeight: '500', color: colors.inkMuted, marginTop: spacing.sm, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.ink,
  },
  formActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, alignItems: 'center' },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  button: {
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  cancelButtonText: { color: colors.inkMuted, fontSize: 14 },
  cancelButton: { paddingVertical: spacing.sm },
  logoutButton: {
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  logoutButtonText: { color: colors.danger, fontWeight: '600', fontSize: 15 },
});
