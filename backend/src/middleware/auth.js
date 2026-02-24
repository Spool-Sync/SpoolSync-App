import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function configurePassport(passport) {
  const opts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
  };

  passport.use(
    new JwtStrategy(opts, async (jwtPayload, done) => {
      try {
        const user = await prisma.user.findUnique({
          where: { userId: jwtPayload.sub },
          include: { customRoles: true },
        });
        if (!user) return done(null, false);
        return done(null, user);
      } catch (err) {
        return done(err, false);
      }
    })
  );
}

import passport from 'passport';

export const authenticate = passport.authenticate('jwt', { session: false });

export function requirePermission(...perms) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (req.user.isSuperAdmin) return next();
    const userPerms = new Set(req.user.customRoles.flatMap((r) => r.permissions));
    if (perms.every((p) => userPerms.has(p))) return next();
    return res.status(403).json({ message: 'Forbidden' });
  };
}
