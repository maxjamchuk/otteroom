import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

// Language resources
const resources = {
  en: {
    translation: {
      home: {
        title: "Welcome to Otteroom",
        createRoom: "Create Room",
        joinRoom: "Join Room",
      },
      createRoom: {
        title: "Create Room",
        selectLanguage: "Room Language",
        selectRegion: "Region (Optional)",
        create: "Create",
        sharing: "Share this code with your guest",
        code: "Code",
        url: "URL",
      },
      joinRoom: {
        title: "Join Room",
        enterCode: "Enter room code",
        scanQR: "Scan QR Code",
        join: "Join",
        codeInvalid: "Invalid code",
      },
      preferences: {
        title: "Select Genres",
        selectMax5: "Select up to 5 genres",
        confirm: "Confirm",
        waiting: "Waiting for other user...",
      },
      voting: {
        title: "What do you think?",
        like: "Like",
        dislike: "Dislike",
        waiting: "Waiting for other vote...",
      },
      match: {
        title: "Match!",
        watched: "Mark as Watched",
        hide: "Hide",
      },
      errors: {
        roomFull: "Room is full",
        roomNotFound: "Room not found",
        roomClosed: "Room is closed",
        tmdbError: "Failed to load movies",
        authError: "Authentication error",
      },
    },
  },
  ru: {
    translation: {
      home: {
        title: "Добро пожаловать в Otteroom",
        createRoom: "Создать комнату",
        joinRoom: "Присоединиться",
      },
      createRoom: {
        title: "Создать комнату",
        selectLanguage: "Язык комнаты",
        selectRegion: "Регион (необязательно)",
        create: "Создать",
        sharing: "Поделитесь этим кодом с гостем",
        code: "Код",
        url: "Ссылка",
      },
      joinRoom: {
        title: "Присоединиться",
        enterCode: "Введите код комнаты",
        scanQR: "Сканировать QR код",
        join: "Присоединиться",
        codeInvalid: "Неверный код",
      },
      preferences: {
        title: "Выберите жанры",
        selectMax5: "Выберите до 5 жанров",
        confirm: "Подтвердить",
        waiting: "Ожидание другого пользователя...",
      },
      voting: {
        title: "Что вы думаете?",
        like: "Понравилось",
        dislike: "Не понравилось",
        waiting: "Ожидание голоса другого пользователя...",
      },
      match: {
        title: "Совпадение!",
        watched: "Отметить как просмотренное",
        hide: "Скрыть",
      },
      errors: {
        roomFull: "Комната полная",
        roomNotFound: "Комната не найдена",
        roomClosed: "Комната закрыта",
        tmdbError: "Не удалось загрузить фильмы",
        authError: "Ошибка аутентификации",
      },
    },
  },
  de: {
    translation: {
      home: {
        title: "Willkommen bei Otteroom",
        createRoom: "Raum erstellen",
        joinRoom: "Raum beitreten",
      },
      createRoom: {
        title: "Raum erstellen",
        selectLanguage: "Raumsprache",
        selectRegion: "Region (optional)",
        create: "Erstellen",
        sharing: "Teilen Sie diesen Code mit Ihrem Gast",
        code: "Code",
        url: "URL",
      },
      joinRoom: {
        title: "Raum beitreten",
        enterCode: "Raumcode eingeben",
        scanQR: "QR-Code scannen",
        join: "Beitreten",
        codeInvalid: "Ungültiger Code",
      },
      preferences: {
        title: "Wählen Sie Genres",
        selectMax5: "Wählen Sie bis zu 5 Genres",
        confirm: "Bestätigen",
        waiting: "Warten auf anderen Benutzer...",
      },
      voting: {
        title: "Was denkst du?",
        like: "Mag ich",
        dislike: "Mag ich nicht",
        waiting: "Warte auf andere Stimme...",
      },
      match: {
        title: "Treffer!",
        watched: "Als angesehen markieren",
        hide: "Verbergen",
      },
      errors: {
        roomFull: "Raum ist voll",
        roomNotFound: "Raum nicht gefunden",
        roomClosed: "Raum ist geschlossen",
        tmdbError: "Filme konnten nicht geladen werden",
        authError: "Authentifizierungsfehler",
      },
    },
  },
  fr: {
    translation: {
      home: {
        title: "Bienvenue sur Otteroom",
        createRoom: "Créer une salle",
        joinRoom: "Rejoindre une salle",
      },
      createRoom: {
        title: "Créer une salle",
        selectLanguage: "Langue de la salle",
        selectRegion: "Région (optionnel)",
        create: "Créer",
        sharing: "Partagez ce code avec votre invité",
        code: "Code",
        url: "URL",
      },
      joinRoom: {
        title: "Rejoindre",
        enterCode: "Entrer le code de la salle",
        scanQR: "Scanner le code QR",
        join: "Rejoindre",
        codeInvalid: "Code invalide",
      },
      preferences: {
        title: "Sélectionnez les genres",
        selectMax5: "Sélectionnez jusqu'à 5 genres",
        confirm: "Confirmer",
        waiting: "En attente de l'autre utilisateur...",
      },
      voting: {
        title: "Qu'en penses-tu?",
        like: "J'aime",
        dislike: "Je n'aime pas",
        waiting: "En attente de l'autre vote...",
      },
      match: {
        title: "Correspondance!",
        watched: "Marquer comme regardé",
        hide: "Masquer",
      },
      errors: {
        roomFull: "La salle est pleine",
        roomNotFound: "Salle non trouvée",
        roomClosed: "La salle est fermée",
        tmdbError: "Impossible de charger les films",
        authError: "Erreur d'authentification",
      },
    },
  },
  es: {
    translation: {
      home: {
        title: "Bienvenido a Otteroom",
        createRoom: "Crear sala",
        joinRoom: "Unirse a sala",
      },
      createRoom: {
        title: "Crear sala",
        selectLanguage: "Idioma de la sala",
        selectRegion: "Región (opcional)",
        create: "Crear",
        sharing: "Comparte este código con tu invitado",
        code: "Código",
        url: "URL",
      },
      joinRoom: {
        title: "Unirse",
        enterCode: "Ingresa el código de la sala",
        scanQR: "Escanear código QR",
        join: "Unirse",
        codeInvalid: "Código inválido",
      },
      preferences: {
        title: "Selecciona géneros",
        selectMax5: "Selecciona hasta 5 géneros",
        confirm: "Confirmar",
        waiting: "Esperando al otro usuario...",
      },
      voting: {
        title: "¿Qué piensas?",
        like: "Me gusta",
        dislike: "No me gusta",
        waiting: "Esperando el voto del otro...",
      },
      match: {
        title: "¡Coincidencia!",
        watched: "Marcar como visto",
        hide: "Ocultar",
      },
      errors: {
        roomFull: "La sala está llena",
        roomNotFound: "Sala no encontrada",
        roomClosed: "La sala está cerrada",
        tmdbError: "No se pudieron cargar las películas",
        authError: "Error de autenticación",
      },
    },
  },
  pt: {
    translation: {
      home: {
        title: "Bem-vindo ao Otteroom",
        createRoom: "Criar sala",
        joinRoom: "Entrar em sala",
      },
      createRoom: {
        title: "Criar sala",
        selectLanguage: "Idioma da sala",
        selectRegion: "Região (opcional)",
        create: "Criar",
        sharing: "Compartilhe este código com seu convidado",
        code: "Código",
        url: "URL",
      },
      joinRoom: {
        title: "Entrar",
        enterCode: "Digite o código da sala",
        scanQR: "Escanear código QR",
        join: "Entrar",
        codeInvalid: "Código inválido",
      },
      preferences: {
        title: "Selecione gêneros",
        selectMax5: "Selecione até 5 gêneros",
        confirm: "Confirmar",
        waiting: "Esperando outro usuário...",
      },
      voting: {
        title: "O que você acha?",
        like: "Gosto",
        dislike: "Não gosto",
        waiting: "Esperando voto do outro...",
      },
      match: {
        title: "Coincidência!",
        watched: "Marcar como assistido",
        hide: "Ocultar",
      },
      errors: {
        roomFull: "A sala está cheia",
        roomNotFound: "Sala não encontrada",
        roomClosed: "A sala está fechada",
        tmdbError: "Não foi possível carregar films",
        authError: "Erro de autenticação",
      },
    },
  },
  tr: {
    translation: {
      home: {
        title: "Otteroom'a hoş geldiniz",
        createRoom: "Oda Oluştur",
        joinRoom: "Odaya Katıl",
      },
      createRoom: {
        title: "Oda Oluştur",
        selectLanguage: "Oda Dili",
        selectRegion: "Bölge (İsteğe Bağlı)",
        create: "Oluştur",
        sharing: "Bu kodu konuğunuzla paylaşın",
        code: "Kod",
        url: "URL",
      },
      joinRoom: {
        title: "Katıl",
        enterCode: "Oda kodunu girin",
        scanQR: "QR Kodu Tara",
        join: "Katıl",
        codeInvalid: "Geçersiz kod",
      },
      preferences: {
        title: "Türleri Seçin",
        selectMax5: "5'e kadar tür seçin",
        confirm: "Onayla",
        waiting: "Diğer kullanıcı bekleniyor...",
      },
      voting: {
        title: "Ne düşünüyorsun?",
        like: "Beğendim",
        dislike: "Beğenmedim",
        waiting: "Diğer oyunun bekleniyor...",
      },
      match: {
        title: "Eşleşme!",
        watched: "İzlendi olarak işaretle",
        hide: "Gizle",
      },
      errors: {
        roomFull: "Oda dolu",
        roomNotFound: "Oda bulunamadı",
        roomClosed: "Oda kapalı",
        tmdbError: "Filmler yüklenemedi",
        authError: "Kimlik doğrulama hatası",
      },
    },
  },
  pl: {
    translation: {
      home: {
        title: "Witamy w Otteroom",
        createRoom: "Utwórz pokój",
        joinRoom: "Dołącz do pokoju",
      },
      createRoom: {
        title: "Utwórz pokój",
        selectLanguage: "Język pokoju",
        selectRegion: "Region (opcjonalnie)",
        create: "Utwórz",
        sharing: "Podziel się tym kodem ze swoim gościem",
        code: "Kod",
        url: "URL",
      },
      joinRoom: {
        title: "Dołącz",
        enterCode: "Wpisz kod pokoju",
        scanQR: "Skanuj kod QR",
        join: "Dołącz",
        codeInvalid: "Nieprawidłowy kod",
      },
      preferences: {
        title: "Wybierz gatunki",
        selectMax5: "Wybierz do 5 gatunków",
        confirm: "Potwierdź",
        waiting: "Oczekiwanie na innego użytkownika...",
      },
      voting: {
        title: "Co myślisz?",
        like: "Podoba mi się",
        dislike: "Nie podoba mi się",
        waiting: "Oczekiwanie na głos innego...",
      },
      match: {
        title: "Dopasowanie!",
        watched: "Oznacz jako obejrzane",
        hide: "Ukryj",
      },
      errors: {
        roomFull: "Pokój jest pełny",
        roomNotFound: "Pokój nie znaleziony",
        roomClosed: "Pokój jest zamknięty",
        tmdbError: "Nie udało się załadować filmów",
        authError: "Błąd uwierzytelniania",
      },
    },
  },
  it: {
    translation: {
      home: {
        title: "Benvenuto a Otteroom",
        createRoom: "Crea stanza",
        joinRoom: "Unisciti a stanza",
      },
      createRoom: {
        title: "Crea stanza",
        selectLanguage: "Lingua stanza",
        selectRegion: "Regione (facoltativo)",
        create: "Crea",
        sharing: "Condividi questo codice con il tuo ospite",
        code: "Codice",
        url: "URL",
      },
      joinRoom: {
        title: "Unisciti",
        enterCode: "Inserisci il codice della stanza",
        scanQR: "Scansiona codice QR",
        join: "Unisciti",
        codeInvalid: "Codice non valido",
      },
      preferences: {
        title: "Seleziona generi",
        selectMax5: "Seleziona fino a 5 generi",
        confirm: "Conferma",
        waiting: "In attesa di altri utenti...",
      },
      voting: {
        title: "Che cosa ne pensi?",
        like: "Mi piace",
        dislike: "Non mi piace",
        waiting: "In attesa del voto di altri...",
      },
      match: {
        title: "Corrispondenza!",
        watched: "Segna come guardato",
        hide: "Nascondi",
      },
      errors: {
        roomFull: "La stanza è piena",
        roomNotFound: "Stanza non trovata",
        roomClosed: "La stanza è chiusa",
        tmdbError: "Impossibile caricare i film",
        authError: "Errore di autenticazione",
      },
    },
  },
};

// Configure i18n
i18n.use(initReactI18next).init({
  resources,
  lng: Localization.getLocales()[0]?.languageCode || "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
