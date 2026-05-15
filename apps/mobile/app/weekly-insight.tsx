import { createWeeklyInsight, tagWeeklyInsight, trackEvent, WeeklyInsight } from "@/src/api/alpha";
import { ActionButton } from "@/src/components/action-button";
import { AlphaCard } from "@/src/components/alpha-card";
import { ScreenShell } from "@/src/components/screen-shell";
import { StateMessage } from "@/src/components/state-message";
import { useNetworkStatus } from "@/src/hooks/use-network-status";
import { useAuth } from "@clerk/clerk-expo";
import { useState } from "react";
import { Text, View } from "react-native";

export default function WeeklyInsightScreen() {
  const { getToken } = useAuth();
  const { isOffline } = useNetworkStatus();
  const [insight, setInsight] = useState<WeeklyInsight | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function generate() {
    setState("loading");
    if (isOffline) {
      setState("error");
      return;
    }
    try {
      const token = await getToken();
      const response = await createWeeklyInsight(token);
      setInsight(response);
      await trackEvent(
        "weekly_insight_opened",
        { source_count: response.source_reflection_ids.length },
        token,
      );
      setState("idle");
    } catch {
      setState("error");
    }
  }

  async function rate(rating: "useful" | "somewhat" | "not_useful") {
    if (!insight) return;
    const token = await getToken();
    await tagWeeklyInsight(insight.id, rating, [], token);
    await trackEvent("weekly_insight_rated", { rating }, token);
  }

  return (
    <ScreenShell title="Weekly Insight">
      <View className="gap-5">
        <AlphaCard title="Review, do not outsource">
          <Text className="text-base leading-7 text-slate-700">
            Ballast should identify patterns from your entries. Treat each insight as a mirror, not
            a verdict.
          </Text>
        </AlphaCard>
        <ActionButton
          label={state === "loading" ? "Synthesizing" : "Generate weekly insight"}
          onPress={generate}
          disabled={state === "loading" || isOffline}
        />
        {isOffline ? (
          <StateMessage
            title="Offline"
            body="Weekly synthesis needs a connection. Your existing reflections remain private."
          />
        ) : null}
        {state === "error" ? (
          <StateMessage
            title="Insight unavailable"
            body="Weekly insight needs enough reflections, a working AI key, and backend access."
          />
        ) : null}
        {!insight && state === "idle" ? (
          <StateMessage
            title="No weekly insight yet"
            body="Generate one after several reflections. Thin evidence should produce a restrained answer."
          />
        ) : null}
        {insight ? (
          <AlphaCard title="This week's pattern">
            <Text className="text-base leading-7 text-slate-700">{insight.summary}</Text>
            <Text className="text-xs text-slate-500">
              Linked to {insight.source_reflection_ids.length} source reflections
            </Text>
            <View className="gap-2">
              <Text className="text-sm font-semibold text-ballast-ink">
                Did this notice something useful?
              </Text>
              <ActionButton label="Yes" variant="secondary" onPress={() => rate("useful")} />
              <ActionButton label="Somewhat" variant="secondary" onPress={() => rate("somewhat")} />
              <ActionButton label="No" variant="secondary" onPress={() => rate("not_useful")} />
            </View>
          </AlphaCard>
        ) : null}
      </View>
    </ScreenShell>
  );
}
