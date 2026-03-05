import { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useVotingStore } from "@/stores/voting.store";

export default function MatchScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const roomId = params.roomId as string;

  const { match, clearVoting } = useVotingStore();

  useEffect(() => {
    if (!match) {
      router.back();
    }
  }, [match, router]);

  const handleWatched = async () => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/mark-movie`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ movie_id: match?.movie_id, status: "watched" }),
        }
      );
      if (!response.ok) throw new Error("Failed");
      Alert.alert("Saved");
    } catch (err) {
      Alert.alert(t("errors.tmdbError"));
    }
  };

  const handleHide = async () => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/mark-movie`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ movie_id: match?.movie_id, status: "hidden" }),
        }
      );
      if (!response.ok) throw new Error("Failed");
      Alert.alert("Saved");
    } catch (err) {
      Alert.alert(t("errors.tmdbError"));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("match.title")}</Text>
      <Text style={styles.details}>Movie ID: {match?.movie_id}</Text>
      <TouchableOpacity style={styles.button} onPress={handleWatched}>
        <Text style={styles.buttonText}>{t("match.watched")}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.hideButton]} onPress={handleHide}>
        <Text style={styles.buttonText}>{t("match.hide")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  details: {
    fontSize: 16,
    marginBottom: 40,
  },
  button: {
    width: "100%",
    paddingVertical: 16,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  hideButton: {
    backgroundColor: "#FF3B30",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
