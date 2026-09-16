# AldoCars — App

App nativo de clientes da AldoCars — Chapeação e Pinturas de Veículos LTDA.
React Native + Expo, consumindo a mesma API do backend `aldo_oficina`.

## Stack

Expo (Expo Router) · React Native · TypeScript.

## Rodando localmente

```bash
git pull --no-rebase
npm install
npx expo start
```

Abre no **Expo Go** (app na Play Store/App Store) escaneando o QR code, ou
num emulador Android/simulador iOS. Ajuste `apiUrl` em `app.json` (dentro de
`expo.extra`) para onde o backend `aldo_oficina` estiver rodando — se for
testar no celular físico, `localhost` não funciona; use o IP da máquina na
mesma rede (ex.: `http://192.168.0.10:3000`).

## Gerando um build instalável (APK/IPA)

Este ambiente de desenvolvimento não tem acesso à internet, então o build
real precisa ser feito por você, fora daqui, via **EAS Build** (serviço de
build na nuvem da Expo — não precisa de Android Studio nem Xcode instalado):

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

O `eas build` sobe o projeto pra nuvem da Expo, compila lá, e devolve um link
pra baixar o `.apk` (perfil `preview`) direto no celular. Primeira vez leva
uns 10-15 minutos. Pra iOS o processo é parecido, mas exige conta Apple
Developer paga.

## Arquitetura de sessão

Mesmo princípio do site do cliente (token nunca em local inseguro), adaptado
pro ambiente nativo: o token fica no **Secure Store** do sistema operacional
(`expo-secure-store`) — Keychain no iOS, Keystore criptografado no Android.
Não é acessível a outros apps nem fica em texto puro em disco. Diferente do
site, aqui não existe o conceito de "route handler" fazendo proxy: o app
fala direto com a API, carregando o token do Secure Store a cada requisição
(`src/lib/api-client.ts`).

## O que já funciona nesta parte

- Autenticação: login e cadastro, sessão persistida no Secure Store.
- Navegação por abas: Início, Agendar, Minha conta — com guarda de rota (sem
  sessão válida, redireciona pro login).
- Início: lista de próximos agendamentos, com cancelamento, atualizada toda
  vez que a aba ganha foco.
- Agendar: escolhe veículo e serviço, consulta horários livres do dia e
  confirma o agendamento — mesmo backend que decide o recurso
  automaticamente, igual ao site.
- Minha conta: dados do cliente, lista de veículos, cadastro de veículo
  novo, logout.

## Próximos passos

1. Seleção de data no agendamento (hoje só busca os horários de hoje).
2. Histórico de ordens de serviço e pagamentos, espelhando o site.
3. Catálogo de produtos com carrinho.
4. Notificações push (agendamento, andamento, conclusão).

## Sobre a checagem de sintaxe deste projeto

Mesma situação dos outros três: sem acesso à internet para `npm install` os
pacotes reais do Expo/React Native. Todo o código foi checado com `tsc` real
contra stubs de tipo das dependências, pegando erros de sintaxe e uso
incorreto de tipos — mas isso não substitui rodar `npm install && npx expo
start` de verdade. Faça isso como primeiro passo, e me avise se algo não
compilar ou não abrir no Expo Go.
