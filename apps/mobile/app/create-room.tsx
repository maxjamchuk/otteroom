import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Share,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Localization from "expo-localization";
import { useRoomStore } from "@/stores/room.store";

const LANGUAGES = [
  { code: "ru", name: "Русский" },
  { code: "en", name: "English" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" },
  { code: "tr", name: "Türkçe" },
  { code: "pl", name: "Polski" },
  { code: "it", name: "Italiano" },
];

export default function CreateRoomScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { createRoom, room, isLoading, error } = useRoomStore();

  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [region, setRegion] = useState<string | undefined>(
    Localization.getLocales()[0]?.regionCode
  );

  const handleCreateRoom = async () => {
    try {
      await createRoom(selectedLanguage, region);
    } catch (err) {
      console.error("Failed to create room:", err);
    }
  };

  useEffect(() => {
    if (room) {
      // Share room code
      const roomUrl = `otteroom:///join?code=${room.code}`;
      Share.share({
        message: `${t("createRoom.sharing")}: ${room.code}\n${roomUrl}`,
        title: "Otteroom",
        url: roomUrl,
      });

      // Navigate to room screen
      setTimeout(() => {
        router.push({
          pathname: "/room",
          params: { roomId: room.id },
        });
      }, 500);
    }
  }, [room, t, router]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t("createRoom.title")}</Text>

      <View style={styles.section}>
        <Text style={styles.label}>{t("createRoom.selectLanguage")}</Text>
        <View style={styles.languageGrid}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageBtn,
                selectedLanguage === lang.code && styles.languageBtnActive,
              ]}
              onPress={() => setSelectedLanguage(lang.code)}
            >
              <Text
                style={[
                  styles.languageBtnText,
                  selectedLanguage === lang.code &&
                    styles.languageBtnTextActive,
                ]}
              >
                {lang.code.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleCreateRoom}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>{t("createRoom.create")}</Text>
        )}
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
    marginTop: 40,
  },
  section: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  languageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  languageBtn: {
    width: "32%",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: "#ccc",
    borderRadius: 8,
    alignItems: "center",
  },
  languageBtnActive: {
    borderColor: "#007AFF",
    backgroundColor: "#007AFF",
  },
  languageBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  languageBtnTextActive: {
    color: "white",
  },
  button: {
    width: "100%",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#34C759",
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "red",
    marginTop: 20,
    textAlign: "center",
  },
});
