import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { requireAuth, requireCouple } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireCouple);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonthThird(date) {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 3);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('entries_couples')
    .select('id, user_id, text, written_month, unlock_date, month_unlocked, created_at, users(display_name)')
    .eq('couple_id', req.user.couple_id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const today = todayStr();
  const entries = (data || []).map((item) => {
    const writer = item.users?.display_name || 'Unknown';
    const dateUnlocked = item.unlock_date && item.unlock_date <= today;
    const isUnlocked = !!item.month_unlocked;
    return {
      id: item.id,
      user_id: item.user_id,
      writer,
      written_month: item.written_month,
      unlock_date: item.unlock_date,
      month_unlocked: item.month_unlocked,
      can_unlock: dateUnlocked,
      created_at: item.created_at,
      // Hide the body until the couple has chosen to unlock the month
      text: isUnlocked ? item.text : null,
    };
  });

  res.json({ entries });
});

const CreateSchema = z.object({
  text: z.string().trim().min(1, 'Write something first').max(5000),
});

router.post('/', async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
  }

  const now = new Date();
  const written_month = formatMonth(now);
  const unlock_date = nextMonthThird(now);

  const { data, error } = await supabase
    .from('entries_couples')
    .insert({
      couple_id: req.user.couple_id,
      user_id: req.user.id,
      text: parsed.data.text,
      written_month,
      unlock_date,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ entry: { ...data, writer: req.user.display_name } });
});

const UnlockSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM'),
});

router.post('/unlock-month', async (req, res) => {
  const parsed = UnlockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { month } = parsed.data;

  const today = todayStr();

  const { data: sample, error: sampleError } = await supabase
    .from('entries_couples')
    .select('unlock_date')
    .eq('couple_id', req.user.couple_id)
    .eq('written_month', month)
    .order('unlock_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (sampleError) return res.status(500).json({ error: sampleError.message });
  if (!sample) return res.status(404).json({ error: 'No entries for that month' });
  if (sample.unlock_date > today) {
    return res.status(400).json({ error: `Can't open this month yet — opens on ${sample.unlock_date}` });
  }

  const { error } = await supabase
    .from('entries_couples')
    .update({ month_unlocked: true })
    .eq('couple_id', req.user.couple_id)
    .eq('written_month', month);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
