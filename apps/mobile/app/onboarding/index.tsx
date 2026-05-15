import { ScreenShell } from "@/src/components/screen-shell";
import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function OnboardingScreen() {
  return (
    <ScreenShell title="Ballast">
      <View className="gap-4">
        <Text className="text-base text-slate-700">
          Onboarding scaffold for account creation, consent, privacy education, and first
          reflection.
        </Text>
        <Link href="/home" className="rounded-lg bg-ballast-tide px-4 py-3 text-center text-white">
          Continue to app shell
        </Link>
      </View>
    </ScreenShell>
  );
}
