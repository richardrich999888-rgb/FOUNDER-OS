import { Text, View } from "react-native";

type StateMessageProps = {
  title: string;
  body: string;
};

export function StateMessage({ title, body }: StateMessageProps) {
  return (
    <View className="rounded-lg border border-dashed border-slate-300 bg-white p-4">
      <Text className="font-semibold text-ballast-ink">{title}</Text>
      <Text className="mt-2 text-sm leading-6 text-slate-600">{body}</Text>
    </View>
  );
}
