import { deleteAccount, requestExport, trackEvent } from "@/src/api/alpha";
import { ActionButton } from "@/src/components/action-button";
import { AlphaCard } from "@/src/components/alpha-card";
import { ScreenShell } from "@/src/components/screen-shell";
import { StateMessage } from "@/src/components/state-message";
import { useNetworkStatus } from "@/src/hooks/use-network-status";
import { useAuth } from "@clerk/clerk-expo";
import { useState } from "react";
import { Text, View } from "react-native";

export default function SettingsScreen() {
  const { getToken } = useAuth();
  const { isOffline } = useNetworkStatus();
  const [status, setStatus] = useState<string | null>(null);

  async function exportData() {
    if (isOffline) {
      setStatus("Export needs a connection.");
      return;
    }
    setStatus("Preparing export request.");
    const token = await getToken();
    await requestExport(token);
    await trackEvent("export_requested", {}, token);
    setStatus("Export request queued.");
  }

  async function removeAccount() {
    if (isOffline) {
      setStatus("Account deletion needs a connection.");
      return;
    }
    setStatus("Deleting account.");
    const token = await getToken();
    await trackEvent("account_deletion_started", {}, token);
    await deleteAccount(token);
    setStatus("Deletion request completed.");
  }

  return (
    <ScreenShell title="Settings">
      <View className="gap-5">
        <AlphaCard title="Privacy controls">
          <Text className="text-base leading-7 text-slate-700">
            Alpha data controls are intentionally visible. You can request an export or delete your
            account from here.
          </Text>
        </AlphaCard>
        {isOffline ? (
          <StateMessage
            title="Offline"
            body="Export and deletion controls are available again when your connection returns."
          />
        ) : null}
        <ActionButton
          label="Request data export"
          variant="secondary"
          onPress={exportData}
          disabled={isOffline}
        />
        <ActionButton
          label="Delete account"
          variant="danger"
          onPress={removeAccount}
          disabled={isOffline}
        />
        {status ? <StateMessage title="Status" body={status} /> : null}
      </View>
    </ScreenShell>
  );
}
