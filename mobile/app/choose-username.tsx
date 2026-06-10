// Choose-username gate — shown right after a new user signs in, before
// they can use the app. A username is required and unique; the
// set_username RPC enforces the format and uniqueness and throws a
// friendly error ("That username is taken"). Users can change it later
// in Settings, so this is just the first-time claim.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';

import { Text, View, useThemeColors } from '@/components/Themed';
import { setUsername } from '@/lib/friends';
import { supabase } from '@/lib/supabase';

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

// Keep only allowed characters as the user types, lowercase, max 30.
function sanitize(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
}

export default function ChooseUsernameScreen() {
  const c = useThemeColors();
  const [username, setUname] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suggest a handle from the Spotify display name on first load.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const name =
        data.user?.user_metadata?.name ??
        data.user?.user_metadata?.full_name ??
        '';
      const suggestion = sanitize(name);
      if (suggestion.length >= 3) setUname(suggestion);
    });
  }, []);

  const valid = USERNAME_RE.test(username);

  const submit = async () => {
    if (!valid || saving) return;
    setError(null);
    setSaving(true);
    try {
      await setUsername(username);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.message ?? 'Could not set username.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pick a username</Text>
      <Text style={[styles.subtitle, { color: c.textMuted }]}>
        This is how friends find and tag you. You can change it later.
      </Text>

      <View style={[styles.inputRow, { borderColor: c.border, backgroundColor: c.inputBackground }]}>
        <Text style={[styles.at, { color: c.textMuted }]}>@</Text>
        <TextInput
          style={[styles.input, { color: c.inputText }]}
          value={username}
          onChangeText={(t) => {
            setUname(sanitize(t));
            setError(null);
          }}
          placeholder="yourname"
          placeholderTextColor={c.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
          maxLength={30}
        />
      </View>

      <Text style={[styles.hint, { color: error ? c.danger : c.textSubtle }]}>
        {error ?? '3–30 characters · lowercase letters, numbers, underscores'}
      </Text>

      <Pressable
        style={[
          styles.button,
          { backgroundColor: c.primary },
          (!valid || saving) && styles.buttonDisabled,
        ]}
        onPress={submit}
        disabled={!valid || saving}
      >
        {saving ? (
          <ActivityIndicator color={c.primaryText} />
        ) : (
          <Text style={[styles.buttonText, { color: c.primaryText }]}>Continue</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: '800' },
  subtitle: { fontSize: 15, marginBottom: 16 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  at: { fontSize: 20, fontWeight: '600' },
  input: { flex: 1, fontSize: 20, paddingVertical: 14, paddingLeft: 4 },
  hint: { fontSize: 13, marginTop: 2, minHeight: 18 },
  button: {
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
