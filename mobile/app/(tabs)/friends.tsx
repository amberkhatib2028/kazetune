// Friends tab — search users, manage incoming/outgoing requests,
// see your accepted friends.

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import {
  acceptFriendRequest,
  listFriendSummary,
  removeFriend,
  searchUsers,
  sendFriendRequest,
  type FriendSummary,
  type UserSearchResult,
} from '@/lib/friends';

export default function FriendsScreen() {
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

  const refreshAll = async () => {
    await load();
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Friends</Text>

      {/* --- Search bar --- */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search by display name"
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={doSearch}
          returnKeyType="search"
          autoCapitalize="none"
        />
        <Pressable
          style={styles.searchBtn}
          onPress={doSearch}
          disabled={searching}
        >
          {searching ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.searchBtnText}>Search</Text>
          )}
        </Pressable>
      </View>

      {/* --- Search results --- */}
      {results.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Results</Text>
          {results.map((r) => (
            <SearchRow
              key={r.id}
              user={r}
              busy={busyId === r.id}
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
              <Text style={styles.sectionLabel}>
                Incoming requests ({incoming.length})
              </Text>
              {incoming.map((s) => (
                <FriendRow
                  key={s.other_id}
                  summary={s}
                  busy={busyId === s.other_id}
                  onAccept={() => handleAccept(s.other_id)}
                  onRemove={() => handleRemove(s.other_id)}
                />
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Friends ({accepted.length})
            </Text>
            {accepted.length === 0 ? (
              <Text style={styles.empty}>None yet — search above to add some.</Text>
            ) : (
              accepted.map((s) => (
                <FriendRow
                  key={s.other_id}
                  summary={s}
                  busy={busyId === s.other_id}
                  onRemove={() => handleRemove(s.other_id)}
                />
              ))
            )}
          </View>

          {outgoing.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Sent ({outgoing.length})
              </Text>
              {outgoing.map((s) => (
                <FriendRow
                  key={s.other_id}
                  summary={s}
                  busy={busyId === s.other_id}
                  onRemove={() => handleRemove(s.other_id)}
                />
              ))}
            </View>
          )}
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

// --- Sub-components --------------------------------------------------

function SearchRow(props: {
  user: UserSearchResult;
  busy: boolean;
  onSend: () => void;
  onAccept: () => void;
  onRemove: () => void;
}) {
  const { user, busy, onSend, onAccept, onRemove } = props;
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {user.display_name ?? '(no name)'}
        </Text>
        {user.spotify_id && (
          <Text style={styles.rowSub}>Spotify: {user.spotify_id}</Text>
        )}
      </View>
      {busy ? (
        <ActivityIndicator />
      ) : user.friendship_status === 'accepted' ? (
        <Text style={styles.badgeAccepted}>friends</Text>
      ) : user.friendship_status === 'pending_outgoing' ? (
        <Pressable style={styles.cancelBtn} onPress={onRemove}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
      ) : user.friendship_status === 'pending_incoming' ? (
        <Pressable style={styles.acceptBtn} onPress={onAccept}>
          <Text style={styles.acceptBtnText}>Accept</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.addBtn} onPress={onSend}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressable>
      )}
    </View>
  );
}

function FriendRow(props: {
  summary: FriendSummary;
  busy: boolean;
  onAccept?: () => void;
  onRemove: () => void;
}) {
  const { summary, busy, onAccept, onRemove } = props;
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {summary.other_display_name ?? '(no name)'}
        </Text>
        {summary.other_spotify_id && (
          <Text style={styles.rowSub}>Spotify: {summary.other_spotify_id}</Text>
        )}
      </View>
      {busy ? (
        <ActivityIndicator />
      ) : (
        <View style={styles.rowActions}>
          {summary.status === 'pending_incoming' && onAccept && (
            <Pressable style={styles.acceptBtn} onPress={onAccept}>
              <Text style={styles.acceptBtnText}>Accept</Text>
            </Pressable>
          )}
          <Pressable style={styles.cancelBtn} onPress={onRemove}>
            <Text style={styles.cancelBtnText}>
              {summary.status === 'accepted'
                ? 'Unfriend'
                : summary.status === 'pending_incoming'
                ? 'Decline'
                : 'Cancel'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
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
    borderColor: '#ccc',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#f7f7f7',
  },
  searchBtn: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderRadius: 24,
    minWidth: 80,
    alignItems: 'center',
  },
  searchBtnText: { color: 'white', fontWeight: '600' },

  section: { marginTop: 20, gap: 4 },
  sectionLabel: {
    fontSize: 12,
    opacity: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
    marginBottom: 4,
    gap: 12,
  },
  rowText: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 11, opacity: 0.5, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 6 },

  addBtn: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },

  acceptBtn: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  acceptBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },

  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#999',
  },
  cancelBtnText: { color: '#666', fontWeight: '600', fontSize: 13 },

  badgeAccepted: {
    fontSize: 11,
    color: '#1DB954',
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  empty: { textAlign: 'center', opacity: 0.5, padding: 16 },
  error: { color: '#c00', marginTop: 16 },
});
