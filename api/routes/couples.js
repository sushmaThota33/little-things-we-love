import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const INVITE_TTL_DAYS = 7;

const CreateCoupleSchema = z.object({
  name: z.string().trim().max(80).optional(),
  encryption_salt: z.string().min(10).max(200),
  encryption_check: z.string().min(10).max(500),
});

router.post('/create', requireAuth, async (req, res) => {
  if (req.user.couple_id) {
    return res.status(400).json({ error: 'You are already in a couple' });
  }

  const parsed = CreateCoupleSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Encryption setup is missing' });
  }
  const { name, encryption_salt, encryption_check } = parsed.data;

  const { data: couple, error } = await supabase
    .from('couples')
    .insert({
      name: name || null,
      created_by: req.user.id,
      encryption_salt,
      encryption_check,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  const { error: memberError } = await supabase
    .from('couple_members')
    .insert({ couple_id: couple.id, user_id: req.user.id });
  if (memberError) return res.status(500).json({ error: memberError.message });

  res.json({ couple });
});

router.post('/invite', requireAuth, async (req, res) => {
  if (!req.user.couple_id) {
    return res.status(400).json({ error: 'Create a couple first' });
  }

  const { count, error: countError } = await supabase
    .from('couple_members')
    .select('*', { count: 'exact', head: true })
    .eq('couple_id', req.user.couple_id);
  if (countError) return res.status(500).json({ error: countError.message });
  if ((count ?? 0) >= 2) return res.status(400).json({ error: 'Couple is already full' });

  const token = crypto.randomBytes(24).toString('base64url');
  const expires_at = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: invite, error } = await supabase
    .from('invitations')
    .insert({
      couple_id: req.user.couple_id,
      invited_by: req.user.id,
      token,
      expires_at,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  res.json({ token: invite.token, expires_at: invite.expires_at });
});

const AcceptSchema = z.object({ token: z.string().min(10) });

router.post('/accept', requireAuth, async (req, res) => {
  const parsed = AcceptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid token' });
  if (req.user.couple_id) {
    return res.status(400).json({ error: 'You are already in a couple' });
  }

  const { data: invite } = await supabase
    .from('invitations')
    .select('*')
    .eq('token', parsed.data.token)
    .maybeSingle();

  if (!invite) return res.status(404).json({ error: 'Invitation not found' });
  if (invite.used_at) return res.status(400).json({ error: 'Invitation already used' });
  if (new Date(invite.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Invitation expired' });
  }

  const { count } = await supabase
    .from('couple_members')
    .select('*', { count: 'exact', head: true })
    .eq('couple_id', invite.couple_id);
  if ((count ?? 0) >= 2) return res.status(400).json({ error: 'Couple is full' });

  const { error: memberError } = await supabase
    .from('couple_members')
    .insert({ couple_id: invite.couple_id, user_id: req.user.id });
  if (memberError) return res.status(500).json({ error: memberError.message });

  await supabase
    .from('invitations')
    .update({ used_at: new Date().toISOString() })
    .eq('id', invite.id);

  res.json({ couple_id: invite.couple_id });
});

router.get('/me', requireAuth, async (req, res) => {
  if (!req.user.couple_id) {
    return res.json({ couple: null, partner: null, members: [] });
  }

  const { data: couple } = await supabase
    .from('couples')
    .select('*')
    .eq('id', req.user.couple_id)
    .single();

  const { data: members } = await supabase
    .from('couple_members')
    .select('user_id, users(id, display_name, email)')
    .eq('couple_id', req.user.couple_id);

  const memberUsers = (members || []).map((m) => m.users).filter(Boolean);
  const partner = memberUsers.find((u) => u.id !== req.user.id) || null;

  res.json({ couple, partner, members: memberUsers });
});

export default router;
