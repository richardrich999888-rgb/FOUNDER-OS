import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@/src/lib/token-cache";
import { RootProviders } from "@/src/providers/root-providers";
import { Stack } from "expo-router";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <RootProviders>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding/index" />
          <Stack.Screen name="home" />
          <Stack.Screen name="reflection" />
          <Stack.Screen name="weekly-insight" />
          <Stack.Screen name="settings" />
        </Stack>
      </RootProviders>
    </ClerkProvider>
  );
}
