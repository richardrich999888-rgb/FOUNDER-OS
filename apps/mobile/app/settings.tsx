import { ScreenShell } from "@/src/components/screen-shell";
import { Text } from "react-native";

export default function SettingsScreen() {
  return (
    <ScreenShell title="Settings">
      <Text className="text-base text-slate-700">
        Settings scaffold for account, notification preferences, exports, privacy controls, and sign
        out.
      </Text>
    </ScreenShell>
  );
}
