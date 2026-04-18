import { verifyToken } from '../lib/jwt.js';
import { supabase } from '../lib/supabase.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, display_name')
    .eq('id', payload.sub)
    .maybeSingle();

  if (error || !user) return res.status(401).json({ error: 'User not found' });

  const { data: membership } = await supabase
    .from('couple_members')
    .select('couple_id')
    .eq('user_id', user.id)
    .maybeSingle();

  req.user = { ...user, couple_id: membership?.couple_id || null };
  next();
}

export function requireCouple(req, res, next) {
  if (!req.user?.couple_id) {
    return res.status(403).json({ error: 'You are not part of a couple yet' });
  }
  next();
}
