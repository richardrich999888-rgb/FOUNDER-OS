import { ScreenShell } from "@/src/components/screen-shell";
import { Text, TextInput, View } from "react-native";

export default function ReflectionScreen() {
  return (
    <ScreenShell title="Reflection">
      <View className="gap-3">
        <Text className="text-base text-slate-700">
          Reflection capture scaffold for typed and voice entries.
        </Text>
        <TextInput
          multiline
          placeholder="What is on your mind?"
          className="min-h-36 rounded-lg border border-slate-200 bg-white p-4 text-base"
        />
      </View>
    </ScreenShell>
  );
}
