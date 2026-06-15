// Profile tab — shows the signed-in user's avatar + display name, lets
// them change their picture, and links to Settings / Sign out.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View as RNView,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { Session } from '@supabase/supabase-js';

import { Avatar } from '@/components/Avatar';
import { Text, View, useThemeColors } from '@/components/Themed';
import { signOut as accountSignOut } from '@/lib/account';
import { pickImage, uploadImage } from '@/lib/images';
import { supabase } from '@/lib/supabase';

type Profile = {
  spotify_id: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  username: string | null;
};

export default function ProfileScreen() {
  const c = useThemeColors();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(sessionData.session);

      if (sessionData.session) {
        const { data, error } = await supabase
          .from('profiles')
          .select('spotify_id, display_name, email, avatar_url, username')
          .eq('id', sessionData.session.user.id)
          .single();
        if (!mounted) return;
        if (error && error.code !== 'PGRST116') {
          console.warn('profile fetch error', error);
        }
        setProfile(data);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const changeAvatar = async () => {
    if (!session) return;
    try {
      const uri = await pickImage();
      if (!uri) return;
      setUploading(true);
      const url = await uploadImage('avatar', uri);
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', session.user.id);
      if (error) throw error;
      setProfile((p) => (p ? { ...p, avatar_url: url } : p));
    } catch (e: any) {
      Alert.alert('Could not update photo', e?.message ?? String(e));
    } finally {
      setUploading(false);
    }
  };

  const signOut = () => {
    Alert.alert('Sign out?', 'You can sign back in with Spotify anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          accountSignOut().catch((e) =>
            Alert.alert('Sign out failed', String(e)),
          );
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={c.text} />
      </View>
    );
  }

  const qrPayload = profile?.username
    ? `kazetune://add-friend/${profile.username}`
    : null;

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.container}
    >
      <Pressable onPress={changeAvatar} disabled={uploading} hitSlop={8}>
        <Avatar
          uri={profile?.avatar_url}
          name={profile?.display_name}
          size={120}
        />
        {uploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
      </Pressable>
      <Pressable onPress={changeAvatar} disabled={uploading} hitSlop={8}>
        <Text style={[styles.changePhoto, { color: c.primary }]}>
          Change photo
        </Text>
      </Pressable>

      <Text style={styles.name}>
        {profile?.display_name ?? '(unnamed)'}
      </Text>
      {profile?.username ? (
        <Text style={[styles.username, { color: c.primary }]}>
          @{profile.username}
        </Text>
      ) : (
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={8}
        >
          <Text style={[styles.usernameCta, { color: c.primary }]}>
            + Set a username
          </Text>
        </Pressable>
      )}

      {qrPayload && (
        <RNView style={[styles.qrCard, { backgroundColor: c.card }]}>
          <RNView style={styles.qrInner}>
            <QRCode
              value={qrPayload}
              size={176}
              backgroundColor="white"
              color="black"
            />
          </RNView>
          <Text style={[styles.qrCaption, { color: c.textMuted }]}>
            Have a friend point their iPhone camera at this to add you.
          </Text>
        </RNView>
      )}

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, { backgroundColor: c.secondaryButton }]}
          onPress={() => router.push('/settings')}
        >
          <Text style={[styles.buttonText, { color: c.text }]}>Settings</Text>
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: c.walkingActive }]}
          onPress={signOut}
        >
          <Text style={[styles.buttonText, { color: '#fff' }]}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 48,
    paddingBottom: 64,
    gap: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },

  qrCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
  },
  qrInner: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
  },
  qrCaption: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 220,
    lineHeight: 17,
  },
  changePhoto: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  name: { fontSize: 24, fontWeight: '700', marginTop: 12 },
  username: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  usernameCta: { fontSize: 13, fontWeight: '600', marginTop: 2, textDecorationLine: 'underline' },
  email: { fontSize: 14 },

  actions: {
    marginTop: 32,
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    minWidth: 180,
    alignItems: 'center',
  },
  buttonText: { fontWeight: '600' },
});
