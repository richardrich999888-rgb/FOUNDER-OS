import { PropsWithChildren } from "react";
import { SafeAreaView, Text, View } from "react-native";

type ScreenShellProps = PropsWithChildren<{
  title: string;
}>;

export function ScreenShell({ title, children }: ScreenShellProps) {
  return (
    <SafeAreaView className="flex-1 bg-ballast-mist">
      <View className="flex-1 gap-6 px-6 py-8">
        <Text className="text-3xl font-semibold text-ballast-ink">{title}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}
