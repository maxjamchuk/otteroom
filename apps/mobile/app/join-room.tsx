import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useRoomStore } from "@/stores/room.store";

export default function JoinRoomScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { joinRoom, isLoading, error } = useRoomStore();

  const [code, setCode] = useState("");

  const handleJoinRoom = async () => {
    if (!code.trim()) return;

    try {
      const room = await joinRoom(code.toUpperCase());
      // Navigate to room screen
      router.push({
        pathname: "/room",
        params: { roomId: room.id },
      });
    } catch (err) {
      console.error("Failed to join room:", err);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t("joinRoom.title")}</Text>

      <View style={styles.section}>
        <Text style={styles.label}>{t("joinRoom.enterCode")}</Text>
        <TextInput
          style={styles.input}
          placeholder="ABC123"
          value={code}
          onChangeText={setCode}
          maxLength={6}
          autoCapitalize="characters"
          placeholderTextColor="#999"
        />
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleJoinRoom}
        disabled={isLoading || !code.trim()}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>{t("joinRoom.join")}</Text>
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
  input: {
    borderWidth: 2,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 2,
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
