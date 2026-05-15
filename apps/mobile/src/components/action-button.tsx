import { Pressable, Text } from "react-native";

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
};

export function ActionButton({
  label,
  onPress,
  disabled = false,
  variant = "primary",
}: ActionButtonProps) {
  const variantClass =
    variant === "danger"
      ? "bg-red-700"
      : variant === "secondary"
        ? "bg-white border border-slate-200"
        : "bg-ballast-tide";
  const textClass = variant === "secondary" ? "text-ballast-ink" : "text-white";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`rounded-lg px-4 py-3 ${variantClass} ${disabled ? "opacity-50" : ""}`}
    >
      <Text className={`text-center text-sm font-semibold ${textClass}`}>{label}</Text>
    </Pressable>
  );
}
