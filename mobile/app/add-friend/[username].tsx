// Add Friend modal — reached via kazetune://add-friend/<username>.
//
// When someone scans a QR code from another user's profile, iOS's
// Camera app sees the kazetune:// scheme and asks to open the app.
// Expo Router routes /add-friend/<username> to this file.
//
// We resolve the @handle to a profile, show a confirmation card
// (avatar, name, current relationship), and let the user send the
// friend request. After it lands, we route them to the Friends tab.

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View as RNView,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Text, View, useThemeColors } from '@/components/Themed';
import {
  acceptFriendRequest,
  lookupUserByUsername,
  removeFriend,
  sendFriendRequest,
  type UserLookupResult,
} from '@/lib/friends';

export default function AddFriendScreen() {
  const c = useThemeColors();
  const { username } = useLocalSearchParams<{ username: string }>();

  const [user, setUser] = useState<UserLookupResult | null | 'not-found'>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const found = await lookupUserByUsername(username);
      setUser(found ?? 'not-found');
    } catch (e: any) {
      setError(e?.message ?? 'Could not look up that user.');
      setUser('not-found');
    }
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/friends');
  };

  const handleSend = async () => {
    if (!user || user === 'not-found') return;
    try {
      setBusy(true);
      await sendFriendRequest(user.id);
      // Refresh to show the new status (probably pending_outgoing, or
      // accepted if they'd already sent us a request).
      await load();
    } catch (e: any) {
      Alert.alert('Could not send', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async () => {
    if (!user || user === 'not-found') return;
    try {
      setBusy(true);
      await acceptFriendRequest(user.id);
      await load();
    } catch (e: any) {
      Alert.alert('Could not accept', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!user || user === 'not-found') return;
    try {
      setBusy(true);
      await removeFriend(user.id);
      await load();
    } catch (e: any) {
      Alert.alert('Could not cancel', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  if (user === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.text} />
      </View>
    );
  }

  if (user === 'not-found') {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundTitle}>User not found</Text>
        <Text style={[styles.notFoundBody, { color: c.textMuted }]}>
          No one with the handle @{username}. They might have changed it,
          or the QR code is for an older account.
        </Text>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: c.primary }]}
          onPress={goBack}
        >
          <Text style={[styles.primaryBtnText, { color: c.primaryText }]}>
            Close
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RNView style={[styles.card, { backgroundColor: c.card }]}>
        <Avatar
          uri={user.avatar_url}
          name={user.display_name}
          size={104}
        />
        <Text style={styles.name}>
          {user.display_name ?? '(unnamed)'}
        </Text>
        {user.username && (
          <Text style={[styles.handle, { color: c.primary }]}>
            @{user.username}
          </Text>
        )}
        {user.spotify_id && (
          <Text style={[styles.spotify, { color: c.textSubtle }]}>
            Spotify: {user.spotify_id}
          </Text>
        )}
      </RNView>

      <RNView style={styles.actions}>
        {user.friendship_status === 'accepted' && (
          <Text style={[styles.statusNote, { color: c.textMuted }]}>
            You're already friends. 🎉
          </Text>
        )}

        {user.friendship_status === 'none' && (
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: c.primary }]}
            onPress={handleSend}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={c.primaryText} />
            ) : (
              <Text style={[styles.primaryBtnText, { color: c.primaryText }]}>
                Send friend request
              </Text>
            )}
          </Pressable>
        )}

        {user.friendship_status === 'pending_outgoing' && (
          <>
            <Text style={[styles.statusNote, { color: c.textMuted }]}>
              Friend request sent. Waiting for them to accept.
            </Text>
            <Pressable
              style={[styles.outlineBtn, { borderColor: c.border }]}
              onPress={handleCancel}
              disabled={busy}
            >
              <Text style={[styles.outlineBtnText, { color: c.textMuted }]}>
                Cancel request
              </Text>
            </Pressable>
          </>
        )}

        {user.friendship_status === 'pending_incoming' && (
          <>
            <Text style={[styles.statusNote, { color: c.textMuted }]}>
              They've already sent you a request.
            </Text>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: c.primary }]}
              onPress={handleAccept}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={c.primaryText} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: c.primaryText }]}>
                  Accept
                </Text>
              )}
            </Pressable>
          </>
        )}

        <Pressable
          style={[styles.outlineBtn, { borderColor: c.border }]}
          onPress={goBack}
        >
          <Text style={[styles.outlineBtnText, { color: c.textMuted }]}>
            Close
          </Text>
        </Pressable>

        {error && (
          <Text style={[styles.error, { color: c.danger }]}>{error}</Text>
        )}
      </RNView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 32, gap: 24, alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },

  card: {
    width: '100%',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  name: { fontSize: 22, fontWeight: '700', marginTop: 8 },
  handle: { fontSize: 15, fontWeight: '700' },
  spotify: { fontSize: 12, marginTop: 4, fontFamily: 'SpaceMono' },

  actions: { width: '100%', gap: 12, alignItems: 'center' },
  statusNote: { fontSize: 13, textAlign: 'center' },

  primaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    minWidth: 220,
    alignItems: 'center',
  },
  primaryBtnText: { fontWeight: '700', fontSize: 15 },

  outlineBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    minWidth: 180,
    alignItems: 'center',
  },
  outlineBtnText: { fontWeight: '600' },

  notFoundTitle: { fontSize: 18, fontWeight: '700' },
  notFoundBody: { fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 16 },

  error: { fontSize: 12, marginTop: 8 },
});
