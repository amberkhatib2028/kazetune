// Blocked accounts — manage (and undo) the people you've blocked.
// Reached from Settings → Safety → Blocked accounts.

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View as RNView,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { Text, View, useThemeColors } from '@/components/Themed';
import {
  listBlockedUsers,
  unblockUser,
  type BlockedUser,
} from '@/lib/moderation';

export default function BlockedScreen() {
  const c = useThemeColors();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await listBlockedUsers());
    } catch {
      // leave the list as-is on a transient error
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onUnblock = (u: BlockedUser) => {
    const who = u.username ? `@${u.username}` : u.display_name ?? 'this person';
    Alert.alert(`Unblock ${who}?`, 'You\'ll be able to see each other again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          try {
            setBusyId(u.id);
            await unblockUser(u.id);
            setUsers((cur) => cur.filter((x) => x.id !== u.id));
          } catch (e: any) {
            Alert.alert('Could not unblock', e?.message ?? String(e));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.text} />
      </View>
    );
  }

  if (users.length === 0) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon="hand.raised.fill"
          title="No blocked accounts"
          subtitle="When you block someone, they'll show up here so you can unblock them later."
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.container}
    >
      {users.map((u) => (
        <RNView key={u.id} style={[styles.row, { backgroundColor: c.card }]}>
          <Avatar uri={u.avatar_url} name={u.display_name} size={40} />
          <RNView style={styles.rowText}>
            <Text style={styles.name} numberOfLines={1}>
              {u.display_name ?? '(unnamed)'}
            </Text>
            {u.username && (
              <Text style={[styles.handle, { color: c.textMuted }]} numberOfLines={1}>
                @{u.username}
              </Text>
            )}
          </RNView>
          <Pressable
            style={[styles.unblockBtn, { backgroundColor: c.secondaryButton }]}
            onPress={() => onUnblock(u)}
            disabled={busyId === u.id}
            hitSlop={8}
          >
            {busyId === u.id ? (
              <ActivityIndicator color={c.text} />
            ) : (
              <Text style={[styles.unblockText, { color: c.text }]}>Unblock</Text>
            )}
          </Pressable>
        </RNView>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600' },
  handle: { fontSize: 12, marginTop: 2 },
  unblockBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  unblockText: { fontWeight: '700', fontSize: 13 },
});
