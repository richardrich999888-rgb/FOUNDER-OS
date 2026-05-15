import { ActionButton } from "@/src/components/action-button";
import { AlphaCard } from "@/src/components/alpha-card";
import { ScreenShell } from "@/src/components/screen-shell";
import { useAppStore } from "@/src/store/app-store";
import { Link } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

const steps = [
  {
    title: "Cognitive observability",
    body: "Ballast is a private mirror for patterns in how you think, decide, recover, and avoid.",
  },
  {
    title: "Not therapy",
    body: "Ballast does not diagnose, treat, or score you. It reflects evidence from your own entries.",
  },
  {
    title: "Your control",
    body: "You can export or delete your account from settings. Reflection text is never sent to analytics.",
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const setHasCompletedOnboarding = useAppStore((state) => state.setHasCompletedOnboarding);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  return (
    <ScreenShell title="Ballast">
      <View className="gap-5">
        <AlphaCard title={step.title}>
          <Text className="text-base leading-7 text-slate-700">{step.body}</Text>
        </AlphaCard>
        <Text className="text-sm text-slate-500">
          Step {index + 1} of {steps.length}
        </Text>
        {isLast ? (
          <Link
            href="/home"
            onPress={() => setHasCompletedOnboarding(true)}
            className="rounded-lg bg-ballast-tide px-4 py-3 text-center text-white"
          >
            Begin private alpha
          </Link>
        ) : (
          <ActionButton label="Continue" onPress={() => setIndex(index + 1)} />
        )}
      </View>
    </ScreenShell>
  );
}
