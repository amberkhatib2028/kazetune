// Friends tab — search users, manage incoming/outgoing requests,
// see your accepted friends.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Text, View, useThemeColors } from '@/components/Themed';
import {
  acceptFriendRequest,
  listFriendSummary,
  removeFriend,
  searchUsers,
  sendFriendRequest,
  type FriendSummary,
  type UserSearchResult,
} from '@/lib/friends';
import { useNotifications } from '@/lib/notifications';

export default function FriendsScreen() {
  const c = useThemeColors();
  const { refresh: refreshBadge } = useNotifications();
  const [summary, setSummary] = useState<FriendSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<UserSearchResult[]>([]);

  const load = useCallback(async () => {
    try {
      setError(null);
      setSummary(await listFriendSummary());
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const doSearch = async () => {
    try {
      setSearching(true);
      setResults(await searchUsers(query));
    } catch (e: any) {
      Alert.alert('Search failed', e?.message ?? String(e));
    } finally {
      setSearching(false);
    }
  };

  // Debounced auto-search as the user types.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const data = await searchUsers(trimmed);
        if (!cancelled) setResults(data);
      } catch (e: any) {
        if (!cancelled) Alert.alert('Search failed', e?.message ?? String(e));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  const refreshAll = async () => {
    await load();
    refreshBadge();
    if (query.trim()) await doSearch();
  };

  const handleSend = async (userId: string) => {
    try {
      setBusyId(userId);
      await sendFriendRequest(userId);
      await refreshAll();
    } catch (e: any) {
      Alert.alert('Could not send', e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleAccept = async (userId: string) => {
    try {
      setBusyId(userId);
      await acceptFriendRequest(userId);
      await refreshAll();
    } catch (e: any) {
      Alert.alert('Could not accept', e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      setBusyId(userId);
      await removeFriend(userId);
      await refreshAll();
    } catch (e: any) {
      Alert.alert('Could not remove', e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  };

  const incoming = summary.filter((s) => s.status === 'pending_incoming');
  const accepted = summary.filter((s) => s.status === 'accepted');
  const outgoing = summary.filter((s) => s.status === 'pending_outgoing');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Friends</Text>

      {/* --- Search bar --- */}
      <View style={styles.searchRow}>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: c.border,
              color: c.inputText,
              backgroundColor: c.inputBackground,
            },
          ]}
          placeholder="Search by name or @username"
          placeholderTextColor={c.placeholder}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <Pressable
            style={[styles.clearBtn, { backgroundColor: c.secondaryButton }]}
            onPress={() => setQuery('')}
            hitSlop={8}
          >
            <Text style={[styles.clearBtnText, { color: c.text }]}>×</Text>
          </Pressable>
        )}
        {searching && (
          <View style={styles.spinnerInline}>
            <ActivityIndicator color={c.text} />
          </View>
        )}
      </View>

      {/* --- Search results --- */}
      {results.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Results</Text>
          {results.map((r) => (
            <SearchRow
              key={r.id}
              user={r}
              busy={busyId === r.id}
              onOpen={() => router.push({ pathname: '/user/[id]', params: { id: r.id } })}
              onSend={() => handleSend(r.id)}
              onAccept={() => handleAccept(r.id)}
              onRemove={() => handleRemove(r.id)}
            />
          ))}
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <>
          {incoming.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
                Incoming requests ({incoming.length})
              </Text>
              {incoming.map((s) => (
                <FriendRow
                  key={s.other_id}
                  summary={s}
                  busy={busyId === s.other_id}
                  onOpen={() => router.push({ pathname: '/user/[id]', params: { id: s.other_id } })}
                  onAccept={() => handleAccept(s.other_id)}
                  onRemove={() => handleRemove(s.other_id)}
                />
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
              Friends ({accepted.length})
            </Text>
            {accepted.length === 0 ? (
              <Text style={[styles.empty, { color: c.textMuted }]}>
                None yet—search above to add some.
              </Text>
            ) : (
              accepted.map((s) => (
                <FriendRow
                  key={s.other_id}
                  summary={s}
                  busy={busyId === s.other_id}
                  onOpen={() => router.push({ pathname: '/user/[id]', params: { id: s.other_id } })}
                  onRemove={() => handleRemove(s.other_id)}
                />
              ))
            )}
          </View>

          {outgoing.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
                Sent ({outgoing.length})
              </Text>
              {outgoing.map((s) => (
                <FriendRow
                  key={s.other_id}
                  summary={s}
                  busy={busyId === s.other_id}
                  onOpen={() => router.push({ pathname: '/user/[id]', params: { id: s.other_id } })}
                  onRemove={() => handleRemove(s.other_id)}
                />
              ))}
            </View>
          )}
        </>
      )}

      {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}
    </ScrollView>
  );
}

// --- Sub-components --------------------------------------------------

function SearchRow(props: {
  user: UserSearchResult;
  busy: boolean;
  onOpen: () => void;
  onSend: () => void;
  onAccept: () => void;
  onRemove: () => void;
}) {
  const c = useThemeColors();
  const { user, busy, onOpen, onSend, onAccept, onRemove } = props;
  return (
    <Pressable style={[styles.row, { backgroundColor: c.card }]} onPress={onOpen}>
      <Avatar uri={user.avatar_url} name={user.display_name} size={40} />
      <RNView style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {user.display_name ?? '(no name)'}
        </Text>
        {user.username && (
          <Text style={[styles.rowSub, { color: c.textSubtle }]}>
            @{user.username}
          </Text>
        )}
      </RNView>
      {busy ? (
        <ActivityIndicator color={c.text} />
      ) : user.friendship_status === 'accepted' ? (
        <Text style={[styles.badgeAccepted, { color: c.primary }]}>friends</Text>
      ) : user.friendship_status === 'pending_outgoing' ? (
        <Pressable
          style={[styles.cancelBtn, { borderColor: c.border }]}
          onPress={onRemove}
        >
          <Text style={[styles.cancelBtnText, { color: c.textMuted }]}>
            Cancel
          </Text>
        </Pressable>
      ) : user.friendship_status === 'pending_incoming' ? (
        <Pressable
          style={[styles.acceptBtn, { backgroundColor: c.primary }]}
          onPress={onAccept}
        >
          <Text style={[styles.acceptBtnText, { color: c.primaryText }]}>
            Accept
          </Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.addBtn, { backgroundColor: c.primary }]}
          onPress={onSend}
        >
          <Text style={[styles.addBtnText, { color: c.primaryText }]}>
            + Add
          </Text>
        </Pressable>
      )}
    </Pressable>
  );
}

function FriendRow(props: {
  summary: FriendSummary;
  busy: boolean;
  onOpen: () => void;
  onAccept?: () => void;
  onRemove: () => void;
}) {
  const c = useThemeColors();
  const { summary, busy, onOpen, onAccept, onRemove } = props;
  return (
    <Pressable style={[styles.row, { backgroundColor: c.card }]} onPress={onOpen}>
      <Avatar
        uri={summary.other_avatar_url}
        name={summary.other_display_name}
        size={40}
      />
      <RNView style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {summary.other_display_name ?? '(no name)'}
        </Text>
      </RNView>
      {busy ? (
        <ActivityIndicator color={c.text} />
      ) : (
        <RNView style={styles.rowActions}>
          {summary.status === 'pending_incoming' && onAccept && (
            <Pressable
              style={[styles.acceptBtn, { backgroundColor: c.primary }]}
              onPress={onAccept}
            >
              <Text style={[styles.acceptBtnText, { color: c.primaryText }]}>
                Accept
              </Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.cancelBtn, { borderColor: c.border }]}
            onPress={onRemove}
          >
            <Text style={[styles.cancelBtnText, { color: c.textMuted }]}>
              {summary.status === 'accepted'
                ? 'Unfriend'
                : summary.status === 'pending_incoming'
                ? 'Decline'
                : 'Cancel'}
            </Text>
          </Pressable>
        </RNView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },

  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
  },
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: { fontSize: 18, lineHeight: 20 },
  spinnerInline: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: { marginTop: 20, gap: 4 },
  sectionLabel: { fontSize: 12, textTransform: 'uppercase', marginBottom: 4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
    gap: 12,
  },
  rowText: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 11, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 6 },

  addBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  addBtnText: { fontWeight: '600', fontSize: 13 },

  acceptBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  acceptBtnText: { fontWeight: '600', fontSize: 13 },

  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  cancelBtnText: { fontWeight: '600', fontSize: 13 },

  badgeAccepted: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  empty: { textAlign: 'center', padding: 16 },
  error: { marginTop: 16 },
});
