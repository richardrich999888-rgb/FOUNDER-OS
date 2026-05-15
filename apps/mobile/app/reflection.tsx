import { createReflection, submitReflectionFeedback, trackEvent } from "@/src/api/alpha";
import { ActionButton } from "@/src/components/action-button";
import { AlphaCard } from "@/src/components/alpha-card";
import { ScreenShell } from "@/src/components/screen-shell";
import { StateMessage } from "@/src/components/state-message";
import { env } from "@/src/config/env";
import { useNetworkStatus } from "@/src/hooks/use-network-status";
import { useAuth } from "@clerk/clerk-expo";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";

export default function ReflectionScreen() {
  const { getToken } = useAuth();
  const { isOffline } = useNetworkStatus();
  const [body, setBody] = useState("");
  const [reflectionId, setReflectionId] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function saveReflection() {
    if (!body.trim()) return;
    if (isOffline) {
      setState("error");
      return;
    }
    setState("saving");
    try {
      const token = await getToken();
      await trackEvent("reflection_started", {}, token);
      const reflection = await createReflection(body, token);
      setReflectionId(reflection.id);
      await trackEvent(
        "reflection_created",
        { length_bucket: body.length > 500 ? "long" : "short" },
        token,
      );
      setState("saved");
    } catch {
      setState("error");
    }
  }

  async function rate(usefulness: "useful" | "somewhat" | "not_useful") {
    if (!reflectionId) return;
    await submitReflectionFeedback(reflectionId, usefulness, await getToken());
  }

  return (
    <ScreenShell title="Reflection">
      <View className="gap-5">
        <AlphaCard title="One honest signal">
          <Text className="text-base leading-7 text-slate-700">
            Write what you noticed. No scoring, no diagnosis, no performance theater.
          </Text>
        </AlphaCard>
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          placeholder="What is on your mind?"
          className="min-h-36 rounded-lg border border-slate-200 bg-white p-4 text-base"
        />
        <ActionButton
          label={state === "saving" ? "Saving privately" : "Save reflection"}
          onPress={saveReflection}
          disabled={state === "saving" || !body.trim() || isOffline}
        />
        {isOffline ? (
          <StateMessage
            title="Offline"
            body="Keep your reflection on this screen and save when your connection returns."
          />
        ) : null}
        {state === "error" ? (
          <StateMessage
            title="Reflection was not saved"
            body="Check auth, network, encryption key, and backend availability. Your typed text stays on this screen."
          />
        ) : null}
        {state === "saved" && env.featureAlphaFeedback ? (
          <AlphaCard title="Did writing this feel useful?">
            <View className="gap-2">
              <ActionButton label="Useful" variant="secondary" onPress={() => rate("useful")} />
              <ActionButton label="Somewhat" variant="secondary" onPress={() => rate("somewhat")} />
              <ActionButton
                label="Not useful"
                variant="secondary"
                onPress={() => rate("not_useful")}
              />
            </View>
          </AlphaCard>
        ) : null}
      </View>
    </ScreenShell>
  );
}
