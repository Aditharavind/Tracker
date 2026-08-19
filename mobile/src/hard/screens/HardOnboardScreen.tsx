import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { hardApi } from "../api";
import type { User } from "../types";

const COLORS = ["#e8734a", "#4a9ee8", "#5cbd7e", "#b76ae8", "#e8c14a"];

export default function HardOnboardScreen({ onDone }: { onDone: (u: User, pin: string) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pinValid = /^\d{4,6}$/.test(pin);

  const submit = async () => {
    if (!name.trim() || !pinValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const user = await hardApi.createUser(name.trim(), color, pin);
      onDone(user, pin);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>75 HARD</Text>
      <Text style={{ color: "#666" }}>No excuses, no compromises. Who's in?</Text>

      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 13, color: "#666" }}>Your name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={40}
          autoFocus
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 }}
        />
      </View>

      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 13, color: "#666" }}>Pick a 4-6 digit PIN (protects your own progress)</Text>
        <TextInput
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D/g, ""))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 }}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
        {COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            accessibilityLabel={`pick ${c}`}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: c,
              borderWidth: c === color ? 3 : 0,
              borderColor: "#fff",
            }}
          />
        ))}
      </View>

      {error ? <Text style={{ color: "#c0392b" }}>{error}</Text> : null}

      <Pressable
        onPress={submit}
        disabled={busy || !name.trim() || !pinValid}
        style={{
          backgroundColor: color,
          padding: 14,
          borderRadius: 10,
          alignItems: "center",
          opacity: busy || !name.trim() || !pinValid ? 0.5 : 1,
        }}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>Start day 1</Text>}
      </Pressable>
    </ScrollView>
  );
}
