import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/services/supabase";

interface RoomMember {
  user_id: string;
  role: string;
  joined_at: string;
}

export default function RoomScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const roomId = params.roomId as string;

  const [members, setMembers] = useState<RoomMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roomStatus, setRoomStatus] = useState("lobby");

  useEffect(() => {
    if (!roomId) {
      router.back();
      return;
    }

    // Fetch room members
    const fetchMembers = async () => {
      const { data, error } = await supabase
        .from("room_members")
        .select("*")
        .eq("room_id", roomId);

      if (!error && data) {
        setMembers(data);
      }

      setIsLoading(false);
    };

    fetchMembers();

    // Subscribe to room updates
    const subscription = supabase
      .from(`rooms:id=eq.${roomId}`)
      .on("*", (payload) => {
        if (payload.new) {
          setRoomStatus(payload.new.status);

          // When room enters voting status, navigate to preferences
          if (payload.new.status === "voting") {
            router.push({
              pathname: "/preferences",
              params: { roomId },
            });
          }
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [roomId, router]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Room</Text>
      <Text style={styles.status}>Status: {roomStatus}</Text>

      <Text style={styles.subtitle}>Members ({members.length}/2)</Text>
      {members.map((member) => (
        <View key={member.user_id} style={styles.memberCard}>
          <Text style={styles.memberRole}>{member.role}</Text>
          <Text style={styles.memberJoined}>
            Joined: {new Date(member.joined_at).toLocaleTimeString()}
          </Text>
        </View>
      ))}

      {members.length < 2 && (
        <Text style={styles.waitingText}>{t("preferences.waiting")}</Text>
      )}

      {roomStatus === "closed" && (
        <Text style={styles.errorText}>
          No more options available, try adjusting filters or restart room.
        </Text>
      )}
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
    marginBottom: 20,
    marginTop: 40,
  },
  status: {
    fontSize: 16,
    marginBottom: 20,
    color: "#666",
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  memberCard: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    marginBottom: 8,
  },
  memberRole: {
    fontSize: 16,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  memberJoined: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  waitingText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
    marginTop: 20,
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    color: "#FF3B30",
    marginTop: 20,
    textAlign: "center",
    fontWeight: "600",
  },
});
