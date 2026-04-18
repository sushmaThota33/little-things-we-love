import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('Missing JWT_SECRET (generate one with: openssl rand -base64 48)');
}

const TTL = '30d';

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: TTL });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
