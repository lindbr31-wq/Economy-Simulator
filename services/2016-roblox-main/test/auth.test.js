import { expect } from "chai";
import { hashPassword, verifyPassword } from "../lib/server/password";

process.env.SESSION_KEY = process.env.SESSION_KEY || 'test-session-key';
// eslint-disable-next-line import/first
import { signSession, verifySession } from "../lib/server/session";

describe('password hashing (argon2id, libsodium-compatible PHC)', () => {
  it('produces a libsodium-style argon2id PHC string', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).to.match(/^\$argon2id\$v=19\$m=32768,t=3,p=1\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/);
  });

  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('hunter2-hunter2');
    expect(await verifyPassword(hash, 'hunter2-hunter2')).eq(true);
    expect(await verifyPassword(hash, 'hunter2-hunter3')).eq(false);
    expect(await verifyPassword('not-a-hash', 'hunter2-hunter2')).eq(false);
  });
});

describe('sessions', () => {
  it('round-trips a signed session', () => {
    const token = signSession({ id: 42, username: 'builderman', session_key: 3 });
    const session = verifySession(token);
    expect(session.id).eq('42');
    expect(session.username).eq('builderman');
    expect(session.sessionKey).eq(3);
  });

  it('rejects garbage tokens', () => {
    expect(() => verifySession('not.a.token')).to.throw();
  });
});
