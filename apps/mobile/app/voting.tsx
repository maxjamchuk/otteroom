import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useRoomStore } from "@/stores/room.store";
import { useVotingStore } from "@/stores/voting.store";

export default function VotingScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const roomId = params.roomId as string;

  const { room } = useRoomStore();
  const { castVote, isVoting, match } = useVotingStore();

  const [movieId, setMovieId] = useState<number | null>(null);

  useEffect(() => {
    if (!room || room.status !== "voting") {
      router.back();
      return;
    }

    setMovieId(room.current_movie_id);
  }, [room, router]);

  useEffect(() => {
    if (match) {
      router.push({ pathname: "/match", params: { roomId } });
    }
  }, [match, router, roomId]);

  const handleVote = async (vote: 1 | -1) => {
    if (!room || !movieId) return;

    try {
      await castVote(room.id, movieId, vote);
    } catch (err) {
      Alert.alert(t("errors.tmdbError"));
    }
  };

  if (!movieId) {
    return (
      <View style={styles.center}>
        <Text>{t("preferences.waiting")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("voting.title")}</Text>
      <View style={styles.card}>
        <View style={styles.posterPlaceholder} />
        <Text style={styles.movieId}>Movie ID: {movieId}</Text>
        {/* In real app you'd fetch details via TMDB and show poster/title/overview */}
      </View>

      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[styles.button, styles.dislikeButton]}
          onPress={() => handleVote(-1)}
          disabled={isVoting}
        >
          {isVoting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>{t("voting.dislike")}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.likeButton]}
          onPress={() => handleVote(1)}
          disabled={isVoting}
        >
          {isVoting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>{t("voting.like")}</Text>
          )}
        </TouchableOpacity>
      </View>

      {isVoting && <Text style={styles.waiting}>{t("voting.waiting")}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 40,
    marginBottom: 20,
    textAlign: "center",
  },
  card: {
    alignItems: "center",
    marginBottom: 30,
  },
  posterPlaceholder: {
    width: 200,
    height: 300,
    backgroundColor: "#ccc",
    borderRadius: 12,
    marginBottom: 12,
  },
  movieId: {
    fontSize: 14,
    color: "#666",
  },
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  likeButton: {
    backgroundColor: "#34C759",
  },
  dislikeButton: {
    backgroundColor: "#FF3B30",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  waiting: {
    marginTop: 20,
    textAlign: "center",
    color: "#666",
  },
});
