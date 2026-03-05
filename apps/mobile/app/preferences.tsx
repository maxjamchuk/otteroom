import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useRoomStore } from "@/stores/room.store";

interface Genre {
  id: number;
  name: string;
}

export default function PreferencesScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const roomId = params.roomId as string;

  const { setPreferences, room, isLoading: roomLoading } = useRoomStore();

  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const language = room?.language || "en";
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/get-genres?language=${language}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch genres");
        }

        const data = await response.json();
        setGenres(data.genres || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load genres"
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (room) {
      fetchGenres();
    }
  }, [room]);

  const toggleGenre = (genreId: number) => {
    const newSelected = new Set(selectedGenres);
    if (newSelected.has(genreId)) {
      newSelected.delete(genreId);
    } else {
      if (newSelected.size < 5) {
        newSelected.add(genreId);
      }
    }
    setSelectedGenres(newSelected);
  };

  const handleConfirm = async () => {
    if (selectedGenres.size === 0) {
      setError("Please select at least one genre");
      return;
    }

    try {
      setIsSubmitting(true);
      await setPreferences(roomId, Array.from(selectedGenres));
      // Navigation will be handled by room subscription
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to set preferences"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t("preferences.title")}</Text>
      <Text style={styles.subtitle}>{t("preferences.selectMax5")}</Text>

      <View style={styles.genresContainer}>
        {genres.map((genre) => (
          <TouchableOpacity
            key={genre.id}
            style={[
              styles.genreTag,
              selectedGenres.has(genre.id) && styles.genreTagSelected,
            ]}
            onPress={() => toggleGenre(genre.id)}
          >
            <Text
              style={[
                styles.genreTagText,
                selectedGenres.has(genre.id) && styles.genreTagTextSelected,
              ]}
            >
              {genre.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.selectedCount}>
        {selectedGenres.size}/5 {t("preferences.title").toLowerCase()}
      </Text>

      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleConfirm}
        disabled={isSubmitting || selectedGenres.size === 0}
      >
        {isSubmitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>{t("preferences.confirm")}</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.waitingText}>{t("preferences.waiting")}</Text>

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
    marginBottom: 12,
    marginTop: 40,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
  },
  genresContainer: {
    flex Wrap: "wrap",
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  genreTag: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: "#ccc",
    borderRadius: 20,
    marginBottom: 8,
  },
  genreTagSelected: {
    borderColor: "#007AFF",
    backgroundColor: "#007AFF",
  },
  genreTagText: {
    fontSize: 14,
    color: "#333",
  },
  genreTagTextSelected: {
    color: "white",
  },
  selectedCount: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  button: {
    width: "100%",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#34C759",
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  waitingText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 10,
  },
  error: {
    color: "red",
    marginTop: 20,
    textAlign: "center",
  },
});
