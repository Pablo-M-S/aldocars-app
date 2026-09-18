import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '@/lib/api-client';
import { colors, spacing, radius } from '@/lib/theme';
import type { CustomerMe, ServiceItem, Vehicle } from '@/lib/types';

interface AvailableSlot {
  startsAt: string;
  endsAt: string;
}

interface DayOption {
  iso: string;
  label: string;
  sublabel: string;
}

// Janela de datas oferecida no app: hoje + 13 dias seguintes. O backend não
// impõe um limite de quantos dias no futuro dá pra consultar/agendar, então
// esse teto é só uma escolha de produto (evita uma lista infinita de chips);
// pode subir sem qualquer mudança no backend.
const DAYS_AHEAD = 14;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildDayOptions(): DayOption[] {
  const options: DayOption[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);

  for (let i = 0; i < DAYS_AHEAD; i += 1) {
    const day = new Date(base);
    day.setDate(base.getDate() + i);
    const iso = day.toISOString().slice(0, 10);
    const sublabel = day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const label = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : day.toLocaleDateString('pt-BR', { weekday: 'short' });
    options.push({ iso, label, sublabel });
  }
  return options;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(value: string): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatSelectedDate(iso: string): string {
  // new Date('YYYY-MM-DD') é interpretado como UTC meia-noite; usamos
  // T00:00:00 local pra evitar a data "voltar um dia" em fusos negativos.
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

type Step = 'form' | 'slots' | 'done';

export default function AgendarScreen() {
  const dayOptions = useMemo(buildDayOptions, []);
  const [services, setServices] = useState<ServiceItem[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadOptions = useCallback(async () => {
    try {
      const [servicesData, me] = await Promise.all([
        api.get<ServiceItem[]>('/services'),
        api.get<CustomerMe>('/customers/me'),
      ]);
      setServices(servicesData);
      setVehicles(me.vehicles);
      setVehicleId((current) => current ?? me.vehicles[0]?.id ?? null);
      setServiceId((current) => current ?? servicesData[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os dados.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOptions();
    }, [loadOptions]),
  );

  function handleSelectDate(iso: string) {
    setDate(iso);
    setStep('form');
    setSlots([]);
  }

  async function handleSearchSlots() {
    if (!serviceId) return;
    setError(null);
    setIsLoading(true);
    try {
      // A rota do backend lê os parâmetros da query string, não do corpo
      // (POST com @Query() no NestJS) — replicamos isso aqui.
      const query = new URLSearchParams({ serviceId, date }).toString();
      const result = await api.post<{ availableSlots: AvailableSlot[] }>(
        `/appointments/availability?${query}`,
      );
      setSlots(result.availableSlots);
      setStep('slots');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível consultar horários.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm(slot: AvailableSlot) {
    if (!vehicleId || !serviceId) return;
    setError(null);
    setIsLoading(true);
    try {
      await api.post('/appointments', { vehicleId, serviceId, startsAt: slot.startsAt });
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível confirmar o agendamento.');
    } finally {
      setIsLoading(false);
    }
  }

  if (services === null || vehicles === null) {
    return (
      <SafeAreaView style={styles.screen} edges={['left', 'right']}>
        <ActivityIndicator style={styles.loading} color={colors.navy} />
      </SafeAreaView>
    );
  }

  if (vehicles.length === 0) {
    return (
      <SafeAreaView style={styles.screen} edges={['left', 'right']}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Cadastre um veículo em "Minha conta" antes de agendar.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'done') {
    return (
      <SafeAreaView style={styles.screen} edges={['left', 'right']}>
        <View style={styles.doneBox}>
          <Text style={styles.doneTitle}>Agendamento confirmado!</Text>
          <Text style={styles.doneSubtitle}>Você pode acompanhar em "Início".</Text>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => {
              setStep('form');
              setSlots([]);
            }}
          >
            <Text style={styles.doneButtonText}>Agendar outro serviço</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const selectedService = services.find((service) => service.id === serviceId);

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Data</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
          {dayOptions.map((day) => {
            const active = date === day.iso;
            return (
              <TouchableOpacity
                key={day.iso}
                style={[styles.dayChip, active && styles.chipActive]}
                onPress={() => handleSelectDate(day.iso)}
              >
                <Text style={[styles.dayChipLabel, active && styles.chipTextActive]}>{day.label}</Text>
                <Text style={[styles.dayChipSublabel, active && styles.chipTextActive]}>{day.sublabel}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionTitle}>Veículo</Text>
        <View style={styles.chipRow}>
          {vehicles.map((vehicle) => (
            <TouchableOpacity
              key={vehicle.id}
              style={[styles.chip, vehicleId === vehicle.id && styles.chipActive]}
              onPress={() => {
                setVehicleId(vehicle.id);
                setStep('form');
              }}
            >
              <Text style={[styles.chipText, vehicleId === vehicle.id && styles.chipTextActive]}>
                {vehicle.plate}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Serviço</Text>
        <View style={styles.chipRow}>
          {services.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={[styles.chip, serviceId === service.id && styles.chipActive]}
              onPress={() => {
                setServiceId(service.id);
                setStep('form');
              }}
            >
              <Text style={[styles.chipText, serviceId === service.id && styles.chipTextActive]}>
                {service.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedService && (
          <Text style={styles.serviceInfo}>
            {formatCurrency(selectedService.price)} · {selectedService.durationMinutes} min
          </Text>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {step === 'form' && (
          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSearchSlots}
            disabled={isLoading || !vehicleId || !serviceId}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Ver horários</Text>
            )}
          </TouchableOpacity>
        )}

        {step === 'slots' && (
          <View style={styles.slotsSection}>
            <Text style={styles.sectionTitle}>Horários em {formatSelectedDate(date)}</Text>
            {slots.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum horário livre nesse dia.</Text>
            ) : (
              <View style={styles.chipRow}>
                {slots.map((slot) => (
                  <TouchableOpacity
                    key={slot.startsAt}
                    style={styles.chip}
                    disabled={isLoading}
                    onPress={() => handleConfirm(slot)}
                  >
                    <Text style={styles.chipText}>{formatTime(slot.startsAt)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg },
  loading: { marginTop: spacing.xl },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.ink, marginTop: spacing.md, marginBottom: spacing.sm },
  dayRow: { gap: spacing.sm, paddingRight: spacing.sm },
  dayChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    minWidth: 56,
  },
  dayChipLabel: { fontSize: 12, fontWeight: '600', color: colors.ink, textTransform: 'capitalize' },
  dayChipSublabel: { fontSize: 11, color: colors.inkMuted, marginTop: 2, fontVariant: ['tabular-nums'] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.canvas,
  },
  chipActive: { borderColor: colors.navy, backgroundColor: colors.navy },
  chipText: { fontSize: 13, color: colors.ink },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  serviceInfo: { fontSize: 13, color: colors.inkMuted, marginTop: spacing.md },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md },
  button: {
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '600', fontSize: 15 },
  slotsSection: { marginTop: spacing.lg },
  emptyText: { fontSize: 14, color: colors.inkMuted },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  doneBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  doneTitle: { fontSize: 18, fontWeight: '600', color: colors.success },
  doneSubtitle: { fontSize: 14, color: colors.inkMuted, marginTop: spacing.xs },
  doneButton: { marginTop: spacing.lg },
  doneButtonText: { color: colors.navy, fontWeight: '600', fontSize: 14 },
});
