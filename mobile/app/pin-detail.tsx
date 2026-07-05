// Pin detail modal — shown when you tap a pin from the Map tab.
// Lets you preview the clip, toggle public/private, or delete the
// pin (only if it's yours). Loads the pin via listPins() and filters
// by id rather than hitting a dedicated RPC; same RLS still applies.

import * as Linking from 'expo-linking';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { ClipPreview } from '@/components/ClipPreview';
import { Text, View, useThemeColors } from '@/components/Themed';
import { VisibilitySelector } from '@/components/VisibilitySelector';
import { getTrack, openTrackInSpotify } from '@/lib/spotify';
import {
  PlaybackError,
  getCurrentPinId,
  openSpotifyApp,
  playPinClip,
  stopPinClip,
} from '@/lib/spotifyPlayback';
import { listPins, type Pin, type PinVisibility } from '@/lib/pins';
import { promptReport } from '@/lib/moderation';
import {
  addPinComment,
  deletePinComment,
  getPinLikeSummary,
  likePin,
  listPinComments,
  unlikePin,
  type PinComment,
} from '@/lib/pinSocial';
import { supabase } from '@/lib/supabase';

// Spotify brand green, per Spotify's design guidelines.
const SPOTIFY_GREEN = '#1DB954';

export default function PinDetailScreen() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [pin, setPin] = useState<Pin | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loadingClip, setLoadingClip] = useState(false);
  // Full track length (pins don't store it) so we can show where the clip
  // sits. 0 until loaded / if the fetch fails.
  const [trackDurationSec, setTrackDurationSec] = useState(0);
  // Owner profile, loaded only for pins that aren't yours (to show
  // "Pinned by …").
  const [owner, setOwner] = useState<{
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null>(null);

  // Likes + comments.
  const [likeCount, setLikeCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);
  const [liking, setLiking] = useState(false);
  const [comments, setComments] = useState<PinComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const loadSocial = useCallback(async () => {
    const [summary, list] = await Promise.all([
      getPinLikeSummary(id).catch(() => ({ like_count: 0, liked_by_me: false })),
      listPinComments(id).catch(() => []),
    ]);
    setLikeCount(summary.like_count);
    setLikedByMe(summary.liked_by_me);
    setComments(list);
  }, [id]);

  const load = useCallback(async () => {
    try {
      const pins = await listPins();
      const found = pins.find((p) => p.id === id) ?? null;
      setPin(found);
      if (found) {
        getTrack(found.spotify_track_id)
          .then((t) => setTrackDurationSec(Math.floor(t.duration_ms / 1000)))
          .catch(() => setTrackDurationSec(0));
      }
      if (found && !found.is_mine && found.user_id) {
        supabase
          .from('profiles')
          .select('display_name, username, avatar_url')
          .eq('id', found.user_id)
          .single()
          .then(({ data }) => setOwner((data as typeof owner) ?? null));
      } else {
        setOwner(null);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Reload every time the screen regains focus — not just on mount — so
  // edits made on the edit-pin screen (e.g. a new clip start) are
  // reflected when we pop back here. Also re-syncs the play/stop state.
  useFocusEffect(
    useCallback(() => {
      load();
      loadSocial();
      setPlaying(getCurrentPinId() === id);
    }, [load, loadSocial, id]),
  );

  // Set when we've sent the user to Spotify to wake it up — on returning
  // to KazeTune we auto-retry the play so they don't have to tap again.
  const playOnReturn = useRef(false);

  // playPinClip drives the user's Spotify (full track, seeked to the
  // pin's start). It throws a PlaybackError with a reason when it can't —
  // surface the right guidance for each case.
  const playNow = useCallback(async () => {
    if (!pin) return;
    setLoadingClip(true);
    try {
      const ok = await playPinClip(pin);
      setPlaying(ok);
    } catch (e) {
      const reason = e instanceof PlaybackError ? e.reason : 'UNKNOWN';
      if (reason === 'NO_DEVICE') {
        Alert.alert(
          'Wake up Spotify',
          'KazeTune plays through your Spotify app. Tap Open Spotify — the clip starts automatically when you come back here.',
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Open Spotify',
              onPress: () => {
                playOnReturn.current = true;
                openSpotifyApp();
              },
            },
          ],
        );
      } else if (reason === 'PREMIUM_REQUIRED') {
        Alert.alert(
          'Spotify Premium required',
          'Playing full tracks needs a Spotify Premium account.',
        );
      } else if (reason === 'EXPIRED' || reason === 'NO_TOKEN') {
        Alert.alert(
          'Spotify session expired',
          'Sign out and sign back in with Spotify to keep playing.',
        );
      } else {
        Alert.alert('Could not play', (e as any)?.message ?? String(e));
      }
    } finally {
      setLoadingClip(false);
    }
  }, [pin]);

  // When we come back from Spotify (which we opened to wake it as a
  // device), retry the play once — after a short beat so Spotify has
  // registered as an available Connect device.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && playOnReturn.current) {
        playOnReturn.current = false;
        setTimeout(() => { playNow(); }, 900);
      }
    });
    return () => sub.remove();
  }, [playNow]);

  const togglePlay = async () => {
    if (!pin) return;
    if (playing) {
      await stopPinClip();
      setPlaying(false);
      return;
    }
    await playNow();
  };

  const onShare = async () => {
    if (!pin) return;
    // Deep link back into this exact pin. expo-linking builds a URL with
    // the app's scheme (kazetune://pin-detail?id=…) so tapping it opens
    // the app straight to this screen. Recipients can only open it if the
    // pin is visible to them — RLS keeps private pins private.
    const url = Linking.createURL('/pin-detail', { queryParams: { id: pin.id } });
    const where = pin.place_name ? ` at ${pin.place_name}` : '';
    try {
      await Share.share({
        message: `🎵 "${pin.track_name}" by ${pin.artist_name}${where} on KazeTune\n${url}`,
        url,
      });
    } catch {
      // User dismissed the share sheet, or it failed — nothing to do.
    }
  };

  const toggleLike = async () => {
    if (liking) return;
    // Optimistic — flip immediately, revert on failure.
    const next = !likedByMe;
    setLikedByMe(next);
    setLikeCount((n) => n + (next ? 1 : -1));
    setLiking(true);
    try {
      if (next) await likePin(id);
      else await unlikePin(id);
    } catch {
      setLikedByMe(!next);
      setLikeCount((n) => n + (next ? -1 : 1));
    } finally {
      setLiking(false);
    }
  };

  const postComment = async () => {
    const body = commentDraft.trim();
    if (!body || postingComment) return;
    setPostingComment(true);
    try {
      await addPinComment(id, body);
      setCommentDraft('');
      await loadSocial();
    } catch (e: any) {
      Alert.alert('Could not post', e?.message ?? String(e));
    } finally {
      setPostingComment(false);
    }
  };

  const removeComment = (commentId: string) => {
    Alert.alert('Delete comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePinComment(commentId);
            setComments((cur) => cur.filter((x) => x.id !== commentId));
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message ?? String(e));
          }
        },
      },
    ]);
  };

  const changeVisibility = async (v: PinVisibility) => {
    if (!pin || v === pin.visibility) return;
    try {
      setBusy(true);
      const { error } = await supabase
        .from('pins')
        .update({ visibility: v })
        .eq('id', pin.id);
      if (error) throw error;
      // The DB trigger keeps is_public = (visibility === 'public').
      setPin({ ...pin, visibility: v, is_public: v === 'public' });
    } catch (e: any) {
      Alert.alert('Could not update', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const deletePin = async () => {
    if (!pin) return;

    // Alert.alert with custom buttons doesn't fire onPress on web —
    // it falls back to window.alert which has no buttons. Use a real
    // confirm() on web and Alert on native.
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(`Delete "${pin.track_name}"?`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Delete this pin?',
              `${pin.track_name}—${pin.artist_name}`,
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => resolve(false),
                },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => resolve(true),
                },
              ],
            );
          });

    if (!confirmed) return;

    try {
      setBusy(true);
      await stopPinClip();
      const { error } = await supabase
        .from('pins')
        .delete()
        .eq('id', pin.id);
      if (error) throw error;
      router.back();
    } catch (e: any) {
      Alert.alert('Could not delete', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.text} />
      </View>
    );
  }

  if (!pin) {
    return (
      <View style={styles.center}>
        <Text style={[styles.notFound, { color: c.textMuted }]}>
          Pin not found.
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: c.walkingActive }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.buttonText, { color: '#fff' }]}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {pin.image_url || pin.album_image_url ? (
        <Image
          source={{ uri: pin.image_url ?? pin.album_image_url! }}
          style={styles.albumArt}
        />
      ) : (
        <RNView style={[styles.artFallback, { backgroundColor: c.primary }]}>
          <Text style={[styles.artLetter, { color: c.primaryText }]}>
            {pin.track_name.charAt(0).toUpperCase()}
          </Text>
        </RNView>
      )}

      <Text style={styles.trackName} numberOfLines={2}>
        {pin.track_name}
      </Text>
      <Text style={[styles.artist, { color: c.textMuted }]} numberOfLines={1}>
        {pin.artist_name}
      </Text>

      {!pin.is_mine && owner && (
        <Pressable
          style={styles.pinnedBy}
          onPress={() =>
            pin.user_id &&
            router.push({ pathname: '/user/[id]', params: { id: pin.user_id } })
          }
        >
          <Avatar uri={owner.avatar_url} name={owner.display_name} size={22} />
          <Text style={[styles.pinnedByText, { color: c.textMuted }]}>
            Pinned by {owner.display_name ?? 'someone'}
            {owner.username ? ` · @${owner.username}` : ''}
          </Text>
        </Pressable>
      )}

      <View style={styles.section}>
        <Text style={[styles.label, { color: c.textMuted }]}>Place</Text>
        <Text style={styles.value}>{pin.place_name ?? '(unnamed)'}</Text>
        <Text style={[styles.coords, { color: c.textSubtle }]}>
          ({pin.latitude.toFixed(2)}, {pin.longitude.toFixed(2)})
        </Text>
      </View>

      {pin.description ? (
        <View style={styles.section}>
          <Text style={[styles.label, { color: c.textMuted }]}>Why here</Text>
          <Text style={[styles.note, { color: c.text }]}>{pin.description}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.label, { color: c.textMuted }]}>Clip</Text>
        {trackDurationSec > 0 ? (
          <ClipPreview
            totalSec={trackDurationSec}
            startSec={pin.start_seconds}
            durationSec={pin.duration_seconds}
          />
        ) : (
          <Text style={styles.value}>
            Starts at {pin.start_seconds}s · {pin.duration_seconds}s long
          </Text>
        )}
      </View>

      <Pressable
        style={[
          styles.playButton,
          { backgroundColor: c.primary },
          loadingClip && styles.disabled,
        ]}
        onPress={togglePlay}
        disabled={loadingClip}
      >
        {loadingClip ? (
          <ActivityIndicator color={c.primaryText} />
        ) : (
          <Text style={[styles.playButtonText, { color: c.primaryText }]}>
            {playing ? '■ Stop' : '▶ Play clip'}
          </Text>
        )}
      </Pressable>

      <Pressable
        style={[styles.secondaryButton, { backgroundColor: c.secondaryButton }]}
        onPress={() =>
          router.push({
            pathname: '/add-to-playlist',
            params: { pinId: pin.id },
          })
        }
      >
        <Text style={[styles.secondaryButtonText, { color: c.text }]}>
          + Add to playlist
        </Text>
      </Pressable>

      <Pressable
        style={[styles.secondaryButton, { backgroundColor: c.secondaryButton }]}
        onPress={onShare}
      >
        <Text style={[styles.secondaryButtonText, { color: c.text }]}>
          ↗ Share pin
        </Text>
      </Pressable>

      <Pressable
        style={[styles.spotifyButton, { borderColor: SPOTIFY_GREEN }]}
        onPress={() => openTrackInSpotify(pin.spotify_track_id)}
      >
        <Text style={[styles.spotifyButtonText, { color: SPOTIFY_GREEN }]}>
          Open in Spotify
        </Text>
      </Pressable>

      {!pin.is_mine && (
        <Pressable
          style={styles.reportButton}
          onPress={() => promptReport('pin', pin.id, 'pin')}
          hitSlop={8}
        >
          <Text style={[styles.reportText, { color: c.textMuted }]}>⚑ Report pin</Text>
        </Pressable>
      )}

      {pin.is_mine && pin.visibility === 'private' && (
        <Text style={[styles.shareHint, { color: c.textSubtle }]}>
          Private—only you can open this. Choose who can see it below.
        </Text>
      )}

      {pin.is_mine && (
        <>
          <Pressable
            style={[styles.secondaryButton, { backgroundColor: c.secondaryButton }]}
            onPress={() =>
              router.push({
                pathname: '/edit-pin' as never,
                params: { id: pin.id },
              } as never)
            }
          >
            <Text style={[styles.secondaryButtonText, { color: c.text }]}>
              ✎ Edit pin
            </Text>
          </Pressable>

          <View style={styles.section}>
            <Text style={[styles.label, { color: c.textMuted }]}>
              Who can see this
            </Text>
            <VisibilitySelector
              value={pin.visibility}
              onChange={changeVisibility}
              disabled={busy}
            />
          </View>

          <Pressable
            style={[
              styles.deleteButton,
              { borderColor: c.danger },
              busy && styles.disabled,
            ]}
            onPress={deletePin}
            disabled={busy}
          >
            <Text style={[styles.deleteButtonText, { color: c.danger }]}>
              Delete pin
            </Text>
          </Pressable>
        </>
      )}

      {/* ---- Likes + comments ------------------------------------- */}
      <View style={styles.socialSection}>
        <Pressable
          style={styles.likeRow}
          onPress={toggleLike}
          hitSlop={8}
          disabled={liking}
        >
          <Text
            style={[styles.likeHeart, { color: likedByMe ? c.primary : c.textSubtle }]}
          >
            {likedByMe ? '♥' : '♡'}
          </Text>
          <Text style={[styles.likeCount, { color: c.textMuted }]}>
            {likeCount} {likeCount === 1 ? 'like' : 'likes'}
          </Text>
        </Pressable>

        <Text style={[styles.label, { color: c.textMuted, marginTop: 18 }]}>
          Comments ({comments.length})
        </Text>

        {comments.length === 0 ? (
          <Text style={[styles.noComments, { color: c.textSubtle }]}>
            No comments yet—be the first.
          </Text>
        ) : (
          comments.map((cm) => (
            <RNView key={cm.id} style={styles.commentRow}>
              <Pressable
                onPress={() =>
                  !cm.is_mine &&
                  router.push({ pathname: '/user/[id]', params: { id: cm.user_id } })
                }
              >
                <Avatar uri={cm.avatar_url} name={cm.display_name} size={34} />
              </Pressable>
              <RNView style={styles.commentBody}>
                <Text style={styles.commentName} numberOfLines={1}>
                  {cm.display_name ?? 'someone'}
                </Text>
                {cm.username ? (
                  <Text
                    style={[styles.commentHandle, { color: c.textMuted }]}
                    numberOfLines={1}
                  >
                    @{cm.username}
                  </Text>
                ) : null}
                <Text style={[styles.commentText, { color: c.text }]}>
                  {cm.body}
                </Text>
                <RNView style={styles.commentActions}>
                  {cm.is_mine || pin.is_mine ? (
                    <Pressable onPress={() => removeComment(cm.id)} hitSlop={6}>
                      <Text style={[styles.commentAction, { color: c.danger }]}>
                        Delete
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => promptReport('comment', cm.id, 'comment')}
                      hitSlop={6}
                    >
                      <Text style={[styles.commentAction, { color: c.textSubtle }]}>
                        Report
                      </Text>
                    </Pressable>
                  )}
                </RNView>
              </RNView>
            </RNView>
          ))
        )}

        <RNView style={styles.commentInputRow}>
          <TextInput
            style={[
              styles.commentInput,
              {
                color: c.inputText,
                backgroundColor: c.inputBackground,
                borderColor: c.border,
              },
            ]}
            placeholder="Add a comment…"
            placeholderTextColor={c.placeholder}
            value={commentDraft}
            onChangeText={setCommentDraft}
            maxLength={500}
            multiline
            editable={!postingComment}
          />
          <Pressable
            style={[
              styles.postBtn,
              { backgroundColor: c.primary },
              (postingComment || !commentDraft.trim()) && styles.disabled,
            ]}
            onPress={postComment}
            disabled={postingComment || !commentDraft.trim()}
          >
            <Text style={[styles.postBtnText, { color: c.primaryText }]}>
              {postingComment ? '…' : 'Post'}
            </Text>
          </Pressable>
        </RNView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, alignItems: 'center', paddingBottom: 64 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  albumArt: {
    width: 140,
    height: 140,
    borderRadius: 12,
    marginBottom: 16,
  },
  artFallback: {
    width: 140,
    height: 140,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  artLetter: { fontSize: 64, fontWeight: '800' },

  trackName: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  artist: { fontSize: 16, marginTop: 4, textAlign: 'center' },

  section: { width: '100%', marginTop: 24, gap: 4 },
  label: { fontSize: 11, textTransform: 'uppercase' },
  value: { fontSize: 16, fontWeight: '500' },
  note: { fontSize: 16, lineHeight: 22, marginTop: 2 },
  pinnedBy: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  pinnedByText: { fontSize: 13, fontWeight: '600' },
  shareHint: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
    lineHeight: 18,
  },
  coords: { fontSize: 12, fontFamily: 'SpaceMono' },
  muted: { fontSize: 12, marginTop: 4 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  publicRow: { width: '100%', marginTop: 24 },

  playButton: {
    marginTop: 32,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 32,
    minWidth: 200,
    alignItems: 'center',
  },
  playButtonText: { fontWeight: '700', fontSize: 16 },

  secondaryButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    minWidth: 180,
    alignItems: 'center',
  },
  secondaryButtonText: { fontWeight: '600' },

  deleteButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    minWidth: 180,
    alignItems: 'center',
  },
  deleteButtonText: { fontWeight: '700' },

  button: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  buttonText: { fontWeight: '600' },

  spotifyButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1.5,
    minWidth: 180,
    alignItems: 'center',
  },
  spotifyButtonText: { fontWeight: '700' },

  reportButton: { marginTop: 18, paddingVertical: 6 },
  reportText: { fontSize: 13, fontWeight: '600' },

  socialSection: { width: '100%', marginTop: 32 },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  likeHeart: { fontSize: 26, lineHeight: 28 },
  likeCount: { fontSize: 15, fontWeight: '600' },
  noComments: { fontSize: 14, marginTop: 8 },
  commentRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  commentBody: { flex: 1, gap: 2 },
  commentName: { fontSize: 13, fontWeight: '700' },
  commentHandle: { fontSize: 12, marginTop: 1 },
  commentText: { fontSize: 15, lineHeight: 20 },
  commentActions: { flexDirection: 'row', marginTop: 2 },
  commentAction: { fontSize: 12, fontWeight: '600' },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 18 },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  postBtn: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtnText: { fontWeight: '700', fontSize: 14 },

  notFound: { fontSize: 16 },
  disabled: { opacity: 0.4 },
});
