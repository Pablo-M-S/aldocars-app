import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@/lib/service-icons';
import { api, ApiError } from '@/lib/api-client';
import { colors, spacing, radius } from '@/lib/theme';
import type { CustomerMe } from '@/lib/types';

// Preencha com o número real de WhatsApp da loja (formato internacional,
// só dígitos: 55 + DDD + número). Deixe vazio ('') para ocultar o atalho.
const WHATSAPP_NUMBER = '';

const HOW_IT_WORKS = [
  {
    icon: 'calendar-check-outline' as const,
    title: 'Você agenda',
    description: 'Escolha o serviço, o veículo e o melhor horário direto pelo app.',
  },
  {
    icon: 'clipboard-text-search-outline' as const,
    title: 'Avaliamos o veículo',
    description: 'No dia marcado, avaliamos o dano e confirmamos o orçamento com você.',
  },
  {
    icon: 'format-paint' as const,
    title: 'Executamos o serviço',
    description: 'Funilaria e pintura feitas por profissionais, com prazo combinado.',
  },
  {
    icon: 'car-outline' as const,
    title: 'Você retira',
    description: 'Avisamos assim que o veículo estiver pronto para retirada.',
  },
];

const QUICK_ACTIONS = [
  { icon: 'calendar-month-outline' as const, label: 'Agendar', route: '/(tabs)/agendar' as const },
  { icon: 'shopping-outline' as const, label: 'Produtos', route: '/(tabs)/produtos' as const },
  { icon: 'file-document-outline' as const, label: 'Histórico', route: '/(tabs)/historico' as const },
  { icon: 'account-outline' as const, label: 'Minha conta', route: '/(tabs)/conta' as const },
];

export default function InicioScreen() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await api.get<CustomerMe>('/customers/me');
      setName(me.user.name?.split(' ')[0] ?? null);
    } catch (err) {
      // Tela de vitrine não depende do nome para funcionar — uma falha aqui
      // (ex.: sessão ainda carregando) não deve travar nem mostrar erro.
      if (!(err instanceof ApiError)) throw err;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openWhatsApp() {
    if (!WHATSAPP_NUMBER) return;
    Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}`);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ALDOCAR · CHAPEAÇÃO E PINTURA DE VEÍCULOS</Text>
          <Text style={styles.greeting}>{name ? `Olá, ${name}` : 'Olá'}</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroAccent} />
          <Text style={styles.heroTitle}>Cuidado profissional em cada detalhe do seu veículo.</Text>
          <Text style={styles.heroSubtitle}>
            Funilaria, pintura e acabamento com a qualidade que seu carro merece.
          </Text>
          <TouchableOpacity style={styles.heroButton} onPress={() => router.push('/(tabs)/agendar')}>
            <Text style={styles.heroButtonText}>Agendar um serviço</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color={colors.navy} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Como funciona</Text>
        <View style={styles.stepsList}>
          {HOW_IT_WORKS.map((step, index) => (
            <View key={step.title} style={styles.stepRow}>
              <View style={styles.stepIconWrap}>
                <MaterialCommunityIcons name={step.icon} size={20} color={colors.navy} />
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>
                  {index + 1}. {step.title}
                </Text>
                <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Acesso rápido</Text>
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.quickCard}
              onPress={() => router.push(action.route)}
            >
              <MaterialCommunityIcons name={action.icon} size={22} color={colors.navy} />
              <Text style={styles.quickLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="clock-outline" size={18} color={colors.inkMuted} />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoTitle}>Horário de funcionamento</Text>
              <Text style={styles.infoText}>Segunda a sexta, das 8h às 18h</Text>
              <Text style={styles.infoTextMuted}>Fechado aos sábados e domingos</Text>
            </View>
          </View>

          {!!WHATSAPP_NUMBER && (
            <TouchableOpacity style={styles.infoRow} onPress={openWhatsApp}>
              <MaterialCommunityIcons name="whatsapp" size={18} color={colors.inkMuted} />
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoTitle}>Fale conosco</Text>
                <Text style={styles.infoText}>Atendimento pelo WhatsApp</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  header: { marginBottom: spacing.md },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.brass,
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.ink },
  hero: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  heroAccent: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.brass,
    opacity: 0.18,
  },
  heroTitle: { fontSize: 19, fontWeight: '700', color: colors.white, lineHeight: 26 },
  heroSubtitle: { fontSize: 13, color: '#C7D0DD', marginTop: spacing.sm, lineHeight: 19 },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  heroButtonText: { fontSize: 13, fontWeight: '700', color: colors.navy },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  stepsList: { gap: spacing.sm, marginBottom: spacing.lg },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  stepIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.brassSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 13, fontWeight: '600', color: colors.ink },
  stepDescription: { fontSize: 12, color: colors.inkMuted, marginTop: 2, lineHeight: 17 },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickCard: {
    width: '47%',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  quickLabel: { fontSize: 12, fontWeight: '600', color: colors.ink },
  infoCard: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  infoTextWrap: { flex: 1 },
  infoTitle: { fontSize: 12, fontWeight: '700', color: colors.ink },
  infoText: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  infoTextMuted: { fontSize: 11, color: colors.inkMuted, marginTop: 1 },
});
