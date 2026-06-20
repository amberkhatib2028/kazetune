// Moderation: blocking users and reporting content.
//
// Required for App Store review of a social app — users must be able to
// block abusive accounts and report objectionable content (Apple
// Guideline 1.2). The heavy lifting (hiding blocked users everywhere) is
// enforced in the database RLS policies; this module is the thin client
// API plus the native report-reason prompt.

import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { supabase } from './supabase';

export type ReportableType = 'pin' | 'playlist' | 'profile';

export type BlockedUser = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
};

// Human-readable reasons, in the order shown in the picker.
const REPORT_REASONS = [
  'Spam or misleading',
  'Harassment or hate',
  'Inappropriate or explicit',
  'Violence or dangerous content',
  'Something else',
];

export async function blockUser(targetId: string): Promise<void> {
  const { error } = await supabase.rpc('block_user', { p_target: targetId });
  if (error) throw error;
}

export async function unblockUser(targetId: string): Promise<void> {
  const { error } = await supabase.rpc('unblock_user', { p_target: targetId });
  if (error) throw error;
}

export async function listBlockedUsers(): Promise<BlockedUser[]> {
  const { data, error } = await supabase.rpc('list_blocked_users');
  if (error) throw error;
  return (data ?? []) as BlockedUser[];
}

export async function reportContent(
  type: ReportableType,
  id: string,
  reason: string,
  details?: string,
): Promise<void> {
  const { error } = await supabase.rpc('report_content', {
    p_content_type: type,
    p_content_id: id,
    p_reason: reason,
    p_details: details ?? null,
  });
  if (error) throw error;
}

// Show a native reason picker, submit the report, and confirm. Resolves
// to true if a report was filed, false if the user cancelled.
export function promptReport(
  type: ReportableType,
  id: string,
  label: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const submit = async (reason: string) => {
      try {
        await reportContent(type, id, reason);
        Alert.alert(
          'Thanks for letting us know',
          'Our team will review this. You can also block this person to stop seeing their content.',
        );
        resolve(true);
      } catch (e: any) {
        Alert.alert('Could not submit report', e?.message ?? String(e));
        resolve(false);
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Report this ${label}`,
          message: 'Why are you reporting it?',
          options: ['Cancel', ...REPORT_REASONS],
          cancelButtonIndex: 0,
        },
        (i) => {
          if (i === 0) return resolve(false);
          submit(REPORT_REASONS[i - 1]);
        },
      );
    } else {
      // Android / fallback: a stacked Alert of reasons.
      Alert.alert(`Report this ${label}`, 'Why are you reporting it?', [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        ...REPORT_REASONS.map((r) => ({ text: r, onPress: () => submit(r) })),
      ]);
    }
  });
}
