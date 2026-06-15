// Settings modal — opened from the Profile tab.
//
// Three sections: Appearance, Walking, Help.
//
// Why inner containers use raw RN View instead of Themed View:
// the Themed <View> auto-paints `c.background` which is pure black in
// dark mode. Inside a row sitting on the slightly-lighter `c.card`
// background, that produces visible dark rectangles around the text.
// Themed View is only used for full-bleed surfaces (the group cards).

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  TextInput,
  View as RNView,
} from 'react-native';

import { Text, View, useThemeColors } from '@/components/Themed';
import { deleteAccount, signOut, updateDisplayName } from '@/lib/account';
import { setUsername } from '@/lib/friends';
import { resetOnboarding } from '@/lib/onboarding';
import { supabase } from '@/lib/supabase';
import {
  useThemePreference,
  type ThemePref,
} from '@/lib/themePreference';
import { useWalkingPreference } from '@/lib/walkingPreference';

const THEME_OPTIONS: { value: ThemePref; label: string; hint: string }[] = [
  { value: 'system', label: 'System', hint: 'Match my device setting' },
  { value: 'light', label: 'Light', hint: 'Always light mode' },
  { value: 'dark', label: 'Dark', hint: 'Always dark mode' },
];

export default function SettingsScreen() {
  const c = useThemeColors();
  const { pref, setPref } = useThemePreference();
  const { policy, setPolicy } = useWalkingPreference();
  const pickUpPublic = policy !== 'never';

  // --- Account state -----------------------------------------------
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  const [currentName, setCurrentName] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [email, setEmail] = useState<string | null>(null);

  // Load on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const { data } = await supabase
        .from('profiles')
        .select('username, display_name, email')
        .eq('id', sessionData.session.user.id)
        .single();
      if (!cancelled && data) {
        setCurrentUsername(data.username);
        setCurrentName(data.display_name);
        setEmail(data.email);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startEditingName = () => {
    setNameDraft(currentName ?? '');
    setEditingName(true);
  };

  const saveDisplayName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === (currentName ?? '')) {
      setEditingName(false);
      return;
    }
    try {
      setSavingName(true);
      await updateDisplayName(trimmed);
      setCurrentName(trimmed);
      setEditingName(false);
    } catch (e: any) {
      Alert.alert('Could not save name', e?.message ?? String(e));
    } finally {
      setSavingName(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in with Spotify anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          // Auth gate sends us back to /login once the session clears.
          signOut().catch((e) => Alert.alert('Sign out failed', String(e)));
        },
      },
    ]);
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and all your pins, playlists, and friends. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Are you absolutely sure?',
              'There is no way to recover your account after this.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete forever',
                  style: 'destructive',
                  onPress: () => {
                    deleteAccount().catch((e: any) =>
                      Alert.alert('Could not delete account', e?.message ?? String(e)),
                    );
                  },
                },
              ],
            ),
        },
      ],
    );
  };

  const startEditingUsername = () => {
    setUsernameDraft(currentUsername ?? '');
    setEditingUsername(true);
  };

  const saveUsername = async () => {
    const cleaned = usernameDraft.trim().toLowerCase().replace(/^@/, '');
    if (cleaned === (currentUsername ?? '')) {
      // No change — just close.
      setEditingUsername(false);
      return;
    }
    try {
      setSavingUsername(true);
      await setUsername(cleaned);
      setCurrentUsername(cleaned);
      setEditingUsername(false);
    } catch (e: any) {
      Alert.alert(
        'Could not set username',
        e?.message ??
          'Try a different one — 3-30 lowercase letters, numbers, or _.',
      );
    } finally {
      setSavingUsername(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.container}
    >
      {/* ---- Account ------------------------------------------------ */}
      <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
        Account
      </Text>
      <View style={[styles.group, { backgroundColor: c.card }]}>
        {editingName ? (
          <RNView
            style={[
              styles.row,
              styles.rowDivider,
              { borderBottomColor: c.separator, gap: 8 },
            ]}
          >
            <TextInput
              style={[
                styles.usernameInput,
                {
                  color: c.inputText,
                  backgroundColor: c.inputBackground,
                  borderColor: c.border,
                },
              ]}
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Your name"
              placeholderTextColor={c.placeholder}
              maxLength={50}
              editable={!savingName}
            />
            {savingName ? (
              <ActivityIndicator color={c.text} />
            ) : (
              <>
                <Pressable onPress={() => setEditingName(false)} hitSlop={8}>
                  <Text style={[styles.linkBtn, { color: c.textMuted }]}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable onPress={saveDisplayName} hitSlop={8}>
                  <Text style={[styles.linkBtn, { color: c.primary }]}>Save</Text>
                </Pressable>
              </>
            )}
          </RNView>
        ) : (
          <Pressable
            style={[styles.row, styles.rowDivider, { borderBottomColor: c.separator }]}
            onPress={startEditingName}
          >
            <RNView style={styles.rowText}>
              <Text style={styles.rowTitle}>Display name</Text>
              <Text style={[styles.rowHint, { color: c.textMuted }]}>
                {currentName ?? 'Set a display name'}
              </Text>
            </RNView>
            <Text style={[styles.linkBtn, { color: c.primary }]}>Change</Text>
          </Pressable>
        )}

        {editingUsername ? (
          <RNView style={[styles.row, { gap: 8 }]}>
            <Text style={[styles.atSign, { color: c.textMuted }]}>@</Text>
            <TextInput
              style={[
                styles.usernameInput,
                {
                  color: c.inputText,
                  backgroundColor: c.inputBackground,
                  borderColor: c.border,
                },
              ]}
              value={usernameDraft}
              onChangeText={setUsernameDraft}
              placeholder="amber_g"
              placeholderTextColor={c.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              editable={!savingUsername}
            />
            {savingUsername ? (
              <ActivityIndicator color={c.text} />
            ) : (
              <>
                <Pressable
                  onPress={() => setEditingUsername(false)}
                  hitSlop={8}
                >
                  <Text style={[styles.linkBtn, { color: c.textMuted }]}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable onPress={saveUsername} hitSlop={8}>
                  <Text style={[styles.linkBtn, { color: c.primary }]}>
                    Save
                  </Text>
                </Pressable>
              </>
            )}
          </RNView>
        ) : (
          <Pressable style={styles.row} onPress={startEditingUsername}>
            <RNView style={styles.rowText}>
              <Text style={styles.rowTitle}>Username</Text>
              <Text style={[styles.rowHint, { color: c.textMuted }]}>
                {currentUsername
                  ? `@${currentUsername}`
                  : 'Pick a handle so friends can find + scan you.'}
              </Text>
            </RNView>
            <Text style={[styles.linkBtn, { color: c.primary }]}>
              {currentUsername ? 'Change' : 'Set'}
            </Text>
          </Pressable>
        )}

        {email && (
          <RNView
            style={[
              styles.row,
              {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: c.separator,
              },
            ]}
          >
            <RNView style={styles.rowText}>
              <Text style={styles.rowTitle}>Email</Text>
              <Text style={[styles.rowHint, { color: c.textMuted }]}>
                {email}
              </Text>
            </RNView>
          </RNView>
        )}
      </View>

      {/* ---- Appearance --------------------------------------------- */}
      <Text style={[styles.sectionLabel, { color: c.textMuted, marginTop: 32 }]}>
        Appearance
      </Text>
      <View style={[styles.group, { backgroundColor: c.card }]}>
        {THEME_OPTIONS.map((opt, i) => {
          const selected = pref === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setPref(opt.value)}
              style={[
                styles.row,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: c.separator,
                },
              ]}
            >
              <RNView style={styles.rowText}>
                <Text style={styles.rowTitle}>{opt.label}</Text>
                <Text style={[styles.rowHint, { color: c.textMuted }]}>
                  {opt.hint}
                </Text>
              </RNView>
              <RNView
                style={[
                  styles.radioOuter,
                  { borderColor: selected ? c.primary : c.border },
                ]}
              >
                {selected && (
                  <RNView
                    style={[styles.radioInner, { backgroundColor: c.primary }]}
                  />
                )}
              </RNView>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.footer, { color: c.textSubtle }]}>
        Theme changes apply instantly.
      </Text>

      {/* ---- Walking ------------------------------------------------ */}
      <Text style={[styles.sectionLabel, { color: c.textMuted, marginTop: 32 }]}>
        Walking
      </Text>
      <View style={[styles.group, { backgroundColor: c.card }]}>
        <RNView style={styles.row}>
          <RNView style={styles.rowText}>
            <Text style={styles.rowTitle}>Pick up public pins from others</Text>
            <Text style={[styles.rowHint, { color: c.textMuted }]}>
              When walking, play clips from public pins other users dropped.
            </Text>
          </RNView>
          <Switch
            value={pickUpPublic}
            onValueChange={(v) => setPolicy(v ? 'always' : 'never')}
          />
        </RNView>

        {pickUpPublic && (
          <>
            <Pressable
              style={[
                styles.row,
                {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: c.separator,
                },
              ]}
              onPress={() => setPolicy('always')}
            >
              <RNView style={styles.rowText}>
                <Text style={styles.rowTitle}>
                  Include public during playlist walks
                </Text>
                <Text style={[styles.rowHint, { color: c.textMuted }]}>
                  Default for playlist walks — you can flip it per walk when
                  you tap "Walk this playlist".
                </Text>
              </RNView>
              <RNView
                style={[
                  styles.radioOuter,
                  { borderColor: policy === 'always' ? c.primary : c.border },
                ]}
              >
                {policy === 'always' && (
                  <RNView
                    style={[styles.radioInner, { backgroundColor: c.primary }]}
                  />
                )}
              </RNView>
            </Pressable>

            <Pressable
              style={[
                styles.row,
                {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: c.separator,
                },
              ]}
              onPress={() => setPolicy('global-only')}
            >
              <RNView style={styles.rowText}>
                <Text style={styles.rowTitle}>
                  Only when not walking a playlist
                </Text>
                <Text style={[styles.rowHint, { color: c.textMuted }]}>
                  Default: playlist walks stay focused on their own pins
                  (still changeable per walk).
                </Text>
              </RNView>
              <RNView
                style={[
                  styles.radioOuter,
                  {
                    borderColor:
                      policy === 'global-only' ? c.primary : c.border,
                  },
                ]}
              >
                {policy === 'global-only' && (
                  <RNView
                    style={[styles.radioInner, { backgroundColor: c.primary }]}
                  />
                )}
              </RNView>
            </Pressable>
          </>
        )}
      </View>
      <Text style={[styles.footer, { color: c.textSubtle }]}>
        Changes take effect the next time you tap Start walking.
      </Text>

      {/* ---- Help --------------------------------------------------- */}
      <Text style={[styles.sectionLabel, { color: c.textMuted, marginTop: 32 }]}>
        Help
      </Text>
      <View style={[styles.group, { backgroundColor: c.card }]}>
        <Pressable
          style={styles.row}
          onPress={() => {
            router.push('/modal');
          }}
        >
          <RNView style={styles.rowText}>
            <Text style={styles.rowTitle}>Show "How it works" again</Text>
            <Text style={[styles.rowHint, { color: c.textMuted }]}>
              Re-open the first-launch walkthrough.
            </Text>
          </RNView>
        </Pressable>
        <Pressable
          style={[
            styles.row,
            {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: c.separator,
            },
          ]}
          onPress={async () => {
            await resetOnboarding();
          }}
        >
          <RNView style={styles.rowText}>
            <Text style={styles.rowTitle}>Reset onboarding flag</Text>
            <Text style={[styles.rowHint, { color: c.textMuted }]}>
              Next launch will auto-pop "How it works" again.
            </Text>
          </RNView>
        </Pressable>
      </View>

      {/* ---- Account actions --------------------------------------- */}
      <View style={[styles.group, { backgroundColor: c.card, marginTop: 32 }]}>
        <Pressable style={styles.row} onPress={confirmSignOut}>
          <Text style={[styles.rowTitle, { color: c.primary }]}>Sign out</Text>
        </Pressable>
        <Pressable
          style={[
            styles.row,
            { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator },
          ]}
          onPress={confirmDeleteAccount}
        >
          <RNView style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: c.danger }]}>
              Delete account
            </Text>
            <Text style={[styles.rowHint, { color: c.textMuted }]}>
              Permanently remove your account and all your data.
            </Text>
          </RNView>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  group: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowHint: { fontSize: 12 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  footer: { fontSize: 12, textAlign: 'center', marginTop: 24 },

  atSign: { fontSize: 16, fontWeight: '700' },
  usernameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 16,
  },
  linkBtn: { fontSize: 14, fontWeight: '700' },
});
