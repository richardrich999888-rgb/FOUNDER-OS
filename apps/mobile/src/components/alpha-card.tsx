import { PropsWithChildren } from "react";
import { Text, View } from "react-native";

type AlphaCardProps = PropsWithChildren<{
  title?: string;
}>;

export function AlphaCard({ title, children }: AlphaCardProps) {
  return (
    <View className="gap-3 rounded-lg border border-slate-200 bg-white p-4">
      {title ? <Text className="text-base font-semibold text-ballast-ink">{title}</Text> : null}
      {children}
    </View>
  );
}
