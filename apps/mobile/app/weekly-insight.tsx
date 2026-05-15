import { ScreenShell } from "@/src/components/screen-shell";
import { Text } from "react-native";

export default function WeeklyInsightScreen() {
  return (
    <ScreenShell title="Weekly Insight">
      <Text className="text-base text-slate-700">
        Weekly insight scaffold for AI-generated synthesis, trend summaries, and founder-safe next
        steps.
      </Text>
    </ScreenShell>
  );
}
