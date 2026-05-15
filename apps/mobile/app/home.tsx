import { ScreenShell } from "@/src/components/screen-shell";
import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <ScreenShell title="Home Mirror">
      <View className="gap-3">
        <Text className="text-base text-slate-700">
          Mirror screen scaffold for daily emotional state, recent reflections, and next best
          action.
        </Text>
        <Link href="/reflection" className="text-ballast-tide">
          New reflection
        </Link>
        <Link href="/weekly-insight" className="text-ballast-tide">
          Weekly insight
        </Link>
        <Link href="/settings" className="text-ballast-tide">
          Settings
        </Link>
      </View>
    </ScreenShell>
  );
}
