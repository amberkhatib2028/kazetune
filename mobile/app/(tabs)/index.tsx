// Home tab — for now, just a session sanity check.
// Eventually this becomes the map screen.

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { Text, View } from '@/components/Themed';
import { supabase } from '@/lib/supabase';

type Profile = {
  spotify_id: string | null;
  display_name: string | null;
  email: string | null;
};

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(sessionData.session);

      if (sessionData.session) {
        const { data, error } = await supabase
          .from('profiles')
          .select('spotify_id, display_name, email')
          .eq('id', sessionData.session.user.id)
          .single();
        if (!mounted) return;
        if (error) console.error('profile fetch error', error);
        setProfile(data);
      }

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    // _layout's auth gate will redirect to /login automatically.
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Signed in</Text>
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      <Text style={styles.label}>Display name</Text>
      <Text style={styles.value}>{profile?.display_name ?? '(missing)'}</Text>
      <Text style={styles.label}>Spotify ID</Text>
      <Text style={styles.value}>{profile?.spotify_id ?? '(missing)'}</Text>
      <Text style={styles.label}>Email</Text>
      <Text style={styles.value}>{profile?.email ?? '(missing)'}</Text>
      <Text style={styles.label}>Auth user ID</Text>
      <Text style={styles.value}>{session?.user.id}</Text>

      <Pressable style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { fontSize: 28, fontWeight: '700' },
  separator: { marginVertical: 24, height: 1, width: '80%' },
  label: { marginTop: 12, opacity: 0.6, fontSize: 12, textTransform: 'uppercase' },
  value: { fontSize: 16, fontWeight: '500' },
  button: {
    marginTop: 32,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#444',
    borderRadius: 24,
  },
  buttonText: { color: 'white', fontWeight: '600' },
});
