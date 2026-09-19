import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { api, ApiError } from '@/lib/api-client';
import { colors, spacing, radius } from '@/lib/theme';
import { getServiceIconName, MaterialCommunityIcons } from '@/lib/service-icons';
import type { Appointment, CustomerMe, ServiceItem, Vehicle } from '@/lib/types';

// O backend já expõe iconKey/priceIsEstimate no Service, mas o tipo
// ServiceItem local pode não ter sido atualizado ainda — tipamos aqui
// em vez de mexer em types.ts, então funciona nos dois casos.
type ServiceWithIcon = ServiceItem & { iconKey?: string | null; priceIsEstimate?: boolean };
type AppointmentWithIcon = Appointment & { service: Appointment['service'] & { iconKey?: string | null } };

const UPCOMING_STATUSES = new Set(['SCHEDULED', 'CONFIRMED']);

// Espelha as regras do backend (scheduling.service.ts) — a checagem real e
// definitiva é sempre lá; isto aqui é só pra já orientar o cliente na hora
// de escolher, evitando que ele tente um horário que o servidor vai recusar.
const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 18;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface DayOption {
  iso: string;
  label: string;
  sublabel: string;
  disabled: boolean;
}

// Janela de datas oferecida no app: hoje + 13 dias seguintes. O backend não
// impõe um limite de quantos dias no futuro dá pra consultar/agendar, então
// esse teto é só uma escolha de produto (evita uma lista infinita de chips);
// pode subir sem qualquer mudança no backend.
const DAYS_AHEAD = 14;

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
    const weekday = day.getDay();
    options.push({ iso, label, sublabel, disabled: weekday === 0 || weekday === 6 });
  }
  return options;
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

function formatHour(value: Date): string {
  return value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

type Step = 'form' | 'done';

export default function AgendarScreen() {
  const dayOptions = useMemo(buildDayOptions, []);
  const firstOpenDay = dayOptions.find((d) => !d.disabled)?.iso ?? dayOptions[0].iso;

  const [services, setServices] = useState<ServiceItem[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState(firstOpenDay);
  const [time, setTime] = useState(() => {
    const base = new Date(`${firstOpenDay}T00:00:00`);
    base.setHours(BUSINESS_START_HOUR + 1, 0, 0, 0);
    return base;
  });
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [appointments, setAppointments] = useState<AppointmentWithIcon[] | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [savedPhone, setSavedPhone] = useState<string | null>(null);
  const [phone, setPhone] = useState('');

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
      setCustomerId(me.id);
      setSavedPhone(me.phone);

      const appointmentsData = await api.get<AppointmentWithIcon[]>(`/appointments/by-customer/${me.id}`);
      setAppointments(appointmentsData.filter((item) => UPCOMING_STATUSES.has(item.status)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os dados.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOptions();
    }, [loadOptions]),
  );

  const selectedService = (services?.find((service) => service.id === serviceId) ?? null) as
    | ServiceWithIcon
    | null;

  const isWeekend = dayOptions.find((d) => d.iso === date)?.disabled ?? false;

  const { minTime, maxTime } = useMemo(() => {
    const base = new Date(`${date}T00:00:00`);
    const min = new Date(base);
    min.setHours(BUSINESS_START_HOUR, 0, 0, 0);
    const max = new Date(base);
    max.setHours(BUSINESS_END_HOUR, 0, 0, 0);
    if (selectedService) {
      max.setMinutes(max.getMinutes() - selectedService.durationMinutes);
    }
    return { minTime: min, maxTime: max };
  }, [date, selectedService]);

  // Sempre que o dia ou o serviço muda, reancora o horário escolhido no novo
  // dia e garante que ele continua dentro da janela válida (min/max podem
  // mudar — um serviço mais longo reduz o horário mais tarde permitido).
  useEffect(() => {
    setTime((current) => {
      const candidate = new Date(`${date}T00:00:00`);
      candidate.setHours(current.getHours(), current.getMinutes(), 0, 0);
      if (candidate < minTime) return new Date(minTime);
      if (candidate > maxTime) return new Date(maxTime);
      return candidate;
    });
  }, [date, minTime, maxTime]);

  function handleTimeChange(_event: DateTimePickerEvent, selected?: Date) {
    if (selected) setTime(selected);
  }

  const needsPhone = !savedPhone;

  async function handleConfirm() {
    if (!vehicleId || !serviceId || !selectedService) return;
    if (isWeekend) {
      setError('A oficina não abre aos sábados e domingos — escolha outro dia.');
      return;
    }
    if (needsPhone && phone.trim() === '') {
      setError('Informe um WhatsApp para contato antes de confirmar.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      if (needsPhone && customerId) {
        await api.patch(`/customers/${customerId}`, { phone: phone.trim() });
        setSavedPhone(phone.trim());
      }
      const startsAt = new Date(`${date}T00:00:00`);
      startsAt.setHours(time.getHours(), time.getMinutes(), 0, 0);
      await api.post('/appointments', { vehicleId, serviceId, startsAt: startsAt.toISOString() });
      setStep('done');
      await loadOptions();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível confirmar o agendamento.');
    } finally {
      setIsLoading(false);
    }
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
      await loadOptions();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível cancelar o agendamento.');
    } finally {
      setCancellingId(null);
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
          <Text style={styles.emptyText}>Cadastre um veículo em &quot;Minha conta&quot; antes de agendar.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'done') {
    return (
      <SafeAreaView style={styles.screen} edges={['left', 'right']}>
        <View style={styles.doneBox}>
          <Text style={styles.doneTitle}>Agendamento confirmado!</Text>
          <Text style={styles.doneSubtitle}>Você pode acompanhar aqui mesmo, em &quot;Meus agendamentos&quot;.</Text>
          <TouchableOpacity style={styles.doneButton} onPress={() => setStep('form')}>
            <Text style={styles.doneButtonText}>Agendar outro serviço</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        {appointments !== null && appointments.length > 0 && (
          <View style={styles.upcomingSection}>
            <Text style={styles.sectionTitle}>Meus agendamentos</Text>
            {appointments.map((item) => (
              <View key={item.id} style={styles.upcomingCard}>
                <View style={styles.upcomingIconWrap}>
                  <MaterialCommunityIcons
                    name={getServiceIconName(item.service.iconKey)}
                    size={20}
                    color={colors.navy}
                  />
                </View>
                <View style={styles.upcomingInfo}>
                  <Text style={styles.upcomingTitle}>{item.service.name}</Text>
                  <Text style={styles.upcomingSubtitle}>
                    {formatDateTime(item.startsAt)} · {item.vehicle.plate}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => confirmCancel(item.id)} disabled={cancellingId === item.id}>
                  <Text style={styles.cancelLink}>
                    {cancellingId === item.id ? 'Cancelando…' : 'Cancelar'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Data</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
          {dayOptions.map((day) => {
            const active = date === day.iso;
            return (
              <TouchableOpacity
                key={day.iso}
                style={[styles.dayChip, active && styles.chipActive, day.disabled && styles.dayChipDisabled]}
                onPress={() => !day.disabled && setDate(day.iso)}
                disabled={day.disabled}
              >
                <Text
                  style={[
                    styles.dayChipLabel,
                    active && styles.chipTextActive,
                    day.disabled && styles.dayChipTextDisabled,
                  ]}
                >
                  {day.label}
                </Text>
                <Text
                  style={[
                    styles.dayChipSublabel,
                    active && styles.chipTextActive,
                    day.disabled && styles.dayChipTextDisabled,
                  ]}
                >
                  {day.sublabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {isWeekend && <Text style={styles.helperText}>Fechado aos sábados e domingos.</Text>}

        <Text style={styles.sectionTitle}>Veículo</Text>
        <View style={styles.chipRow}>
          {vehicles.map((vehicle) => (
            <TouchableOpacity
              key={vehicle.id}
              style={[styles.chip, vehicleId === vehicle.id && styles.chipActive]}
              onPress={() => setVehicleId(vehicle.id)}
            >
              <Text style={[styles.chipText, vehicleId === vehicle.id && styles.chipTextActive]}>
                {vehicle.plate}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Serviço</Text>
        <View style={styles.serviceList}>
          {services.map((service) => {
            const active = serviceId === service.id;
            const iconKey = (service as ServiceWithIcon).iconKey;
            const priceIsEstimate = (service as ServiceWithIcon).priceIsEstimate;
            return (
              <TouchableOpacity
                key={service.id}
                style={[styles.serviceCard, active && styles.serviceCardActive]}
                onPress={() => setServiceId(service.id)}
              >
                <View style={[styles.serviceIconWrap, active && styles.serviceIconWrapActive]}>
                  <MaterialCommunityIcons
                    name={getServiceIconName(iconKey)}
                    size={20}
                    color={active ? colors.white : colors.navy}
                  />
                </View>
                <View style={styles.serviceCardBody}>
                  <Text style={[styles.serviceCardTitle, active && styles.chipTextActive]}>{service.name}</Text>
                  <Text style={[styles.serviceCardMeta, active && styles.serviceCardMetaActive]}>
                    {priceIsEstimate ? 'Valor sob avaliação' : formatCurrency(service.price)} · {service.durationMinutes} min
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {!isWeekend && (
          <>
            <Text style={styles.sectionTitle}>Horário em {formatSelectedDate(date)}</Text>
            <Text style={styles.helperText}>
              Entre {formatHour(minTime)} e {formatHour(maxTime)}
            </Text>
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={time}
                mode="time"
                display="spinner"
                is24Hour
                locale="pt-BR"
                minimumDate={minTime}
                maximumDate={maxTime}
                onChange={handleTimeChange}
                style={styles.picker}
              />
            </View>
          </>
        )}

        {needsPhone && (
          <>
            <Text style={styles.sectionTitle}>WhatsApp para contato</Text>
            <TextInput
              style={styles.input}
              placeholder="(00) 00000-0000"
              placeholderTextColor={colors.inkMuted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <Text style={styles.helperText}>
              Usamos esse número só para falar sobre o orçamento e o andamento do seu veículo.
            </Text>
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={isLoading || !vehicleId || !serviceId || isWeekend || (needsPhone && phone.trim() === '')}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Confirmar agendamento</Text>
          )}
        </TouchableOpacity>
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
  dayChipDisabled: { opacity: 0.4 },
  dayChipLabel: { fontSize: 12, fontWeight: '600', color: colors.ink, textTransform: 'capitalize' },
  dayChipSublabel: { fontSize: 11, color: colors.inkMuted, marginTop: 2, fontVariant: ['tabular-nums'] },
  dayChipTextDisabled: { color: colors.inkMuted },
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
  serviceList: { gap: spacing.sm },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.canvas,
    padding: spacing.sm,
  },
  serviceCardActive: { borderColor: colors.navy, backgroundColor: colors.navy },
  serviceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.brassSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  serviceIconWrapActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  serviceCardBody: { flex: 1 },
  serviceCardTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  serviceCardMeta: { fontSize: 12, color: colors.inkMuted, marginTop: 2, fontVariant: ['tabular-nums'] },
  serviceCardMetaActive: { color: '#C7D0DD' },
  pickerWrap: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    overflow: 'hidden',
  },
  picker: { width: '100%', height: Platform.OS === 'ios' ? 170 : 140 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.canvas,
    fontSize: 14,
    color: colors.ink,
  },
  helperText: { fontSize: 11, color: colors.inkMuted, marginTop: spacing.xs },
  upcomingSection: { marginBottom: spacing.lg },
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  upcomingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.brassSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  upcomingInfo: { flex: 1 },
  upcomingTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  upcomingSubtitle: { fontSize: 12, color: colors.inkMuted, marginTop: 2, fontVariant: ['tabular-nums'] },
  cancelLink: { color: colors.danger, fontSize: 12, fontWeight: '600' },
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
  emptyText: { fontSize: 14, color: colors.inkMuted },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  doneBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  doneTitle: { fontSize: 18, fontWeight: '600', color: colors.success },
  doneSubtitle: { fontSize: 14, color: colors.inkMuted, marginTop: spacing.xs },
  doneButton: { marginTop: spacing.lg },
  doneButtonText: { color: colors.navy, fontWeight: '600', fontSize: 14 },
});
