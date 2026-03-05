import { useEffect } from "react";
import { Stack } from "expo-router";
import { useAuthStore } from "@/stores/auth.store";
import "@/i18n";

export default function RootLayout() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
