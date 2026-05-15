import {
  evaluateRetrieval,
  listReflections,
  MemorySearchItem,
  searchMemory,
} from "@/src/api/alpha";
import { ActionButton } from "@/src/components/action-button";
import { AlphaCard } from "@/src/components/alpha-card";
import { ScreenShell } from "@/src/components/screen-shell";
import { StateMessage } from "@/src/components/state-message";
import { env } from "@/src/config/env";
import { useNetworkStatus } from "@/src/hooks/use-network-status";
import { useAuth } from "@clerk/clerk-expo";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";

export default function HomeScreen() {
  const { getToken } = useAuth();
  const { isOffline } = useNetworkStatus();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemorySearchItem[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "error" | "done">("idle");

  const reflectionsQuery = useQuery({
    queryKey: ["reflections"],
    queryFn: async () => listReflections(await getToken()),
  });

  async function runSearch() {
    if (!query.trim()) return;
    if (isOffline) {
      setSearchState("error");
      return;
    }
    setSearchState("loading");
    try {
      const response = await searchMemory(query, await getToken());
      setResults(response.items);
      setSearchState("done");
    } catch {
      setSearchState("error");
    }
  }

  async function rateSearch(userRating: "found_it" | "close" | "missed") {
    await evaluateRetrieval(query, results, userRating, await getToken());
  }

  return (
    <ScreenShell title="Home Mirror">
      <View className="gap-5">
        <AlphaCard title="Today">
          <Text className="text-base leading-7 text-slate-700">
            Capture one real signal. Short, honest entries are enough for alpha.
          </Text>
        </AlphaCard>
        <Link href="/reflection" className="text-ballast-tide">
          New reflection
        </Link>
        <Link href="/weekly-insight" className="text-ballast-tide">
          Weekly insight
        </Link>
        <Link href="/settings" className="text-ballast-tide">
          Settings
        </Link>

        {reflectionsQuery.isLoading ? (
          <StateMessage title="Loading reflections" body="Preparing your private mirror." />
        ) : reflectionsQuery.isError ? (
          <StateMessage
            title="Could not load reflections"
            body="Check connection and sign-in state, then try again."
          />
        ) : !reflectionsQuery.data?.items.length ? (
          <StateMessage
            title="No reflections yet"
            body="Write one entry to start building memory. The first useful insight usually needs a few entries."
          />
        ) : (
          <AlphaCard title="Recent signal">
            <Text className="text-sm leading-6 text-slate-700">
              {reflectionsQuery.data.items[0].body}
            </Text>
          </AlphaCard>
        )}

        <AlphaCard title="Search your own mind">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="What pattern are you trying to understand?"
            className="rounded-lg border border-slate-200 bg-white p-3 text-base"
          />
          {isOffline ? (
            <StateMessage
              title="Offline"
              body="You can still think through the question, but memory search needs a connection."
            />
          ) : null}
          <ActionButton
            label={searchState === "loading" ? "Searching" : "Search memory"}
            onPress={runSearch}
            disabled={searchState === "loading" || isOffline}
          />
          {searchState === "error" ? (
            <StateMessage
              title="Search failed"
              body="Memory search needs a working connection, auth token, OpenAI key, and database."
            />
          ) : null}
          {searchState === "done" && results.length === 0 ? (
            <StateMessage
              title="No close memory found"
              body="Try a more concrete phrase, or add more reflections before evaluating retrieval quality."
            />
          ) : null}
          {results.slice(0, 3).map((item) => (
            <View key={item.id} className="rounded-lg bg-slate-50 p-3">
              <Text className="text-sm leading-6 text-slate-700">{item.content}</Text>
              <Text className="mt-2 text-xs text-slate-500">
                similarity {Math.round(item.similarity * 100)}%
              </Text>
            </View>
          ))}
          {results.length && env.featureRetrievalEvaluation ? (
            <View className="gap-2">
              <Text className="text-sm font-semibold text-ballast-ink">Did search find it?</Text>
              <ActionButton
                label="Yes"
                variant="secondary"
                onPress={() => rateSearch("found_it")}
              />
              <ActionButton label="Close" variant="secondary" onPress={() => rateSearch("close")} />
              <ActionButton
                label="Missed"
                variant="secondary"
                onPress={() => rateSearch("missed")}
              />
            </View>
          ) : null}
        </AlphaCard>
      </View>
    </ScreenShell>
  );
}
