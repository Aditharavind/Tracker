import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { api } from "../api";
import type { OnboardPayload, OnboardResult } from "../types";

type Props = {
  onDone: (result: OnboardResult) => void;
};

const initial: OnboardPayload = {
  email: "",
  password: "",
  goal_title: "",
  goal_why: "",
  wake_time: "06:30",
  sleep_time: "22:30",
  energy_pattern: "",
  meals_per_day: 3,
  exercise_needs: "",
  current_habits: "",
};

export default function OnboardingScreen({ onDone }: Props) {
  const [form, setForm] = useState<OnboardPayload>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof OnboardPayload>(key: K, value: OnboardPayload[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await api.onboard(form);
      onDone(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Set up your coach</Text>

      <Field label="Email" value={form.email} onChangeText={(v) => set("email", v)} autoCapitalize="none" />
      <Field label="Password" value={form.password} onChangeText={(v) => set("password", v)} secureTextEntry />
      <Field label="Your top goal" value={form.goal_title} onChangeText={(v) => set("goal_title", v)} />
      <Field label="Why it matters" value={form.goal_why} onChangeText={(v) => set("goal_why", v)} multiline />
      <Field label="Wake time (HH:MM)" value={form.wake_time} onChangeText={(v) => set("wake_time", v)} />
      <Field label="Sleep time (HH:MM)" value={form.sleep_time} onChangeText={(v) => set("sleep_time", v)} />
      <Field
        label="Energy pattern"
        value={form.energy_pattern}
        onChangeText={(v) => set("energy_pattern", v)}
        placeholder="e.g. sharpest 7-10am, dip after lunch"
        multiline
      />
      <Field
        label="Exercise needs"
        value={form.exercise_needs}
        onChangeText={(v) => set("exercise_needs", v)}
      />
      <Field
        label="Current habits"
        value={form.current_habits}
        onChangeText={(v) => set("current_habits", v)}
        multiline
      />

      {error ? <Text style={{ color: "#c0392b" }}>{error}</Text> : null}

      <Pressable
        onPress={submit}
        disabled={busy}
        style={{ backgroundColor: "#e8734a", padding: 14, borderRadius: 10, alignItems: "center", marginTop: 8 }}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>Generate my day</Text>}
      </Pressable>
    </ScrollView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 13, color: "#666" }}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        secureTextEntry={props.secureTextEntry}
        multiline={props.multiline}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 8,
          padding: 10,
          minHeight: props.multiline ? 60 : undefined,
        }}
      />
    </View>
  );
}
