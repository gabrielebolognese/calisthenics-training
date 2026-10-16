// GET /api/backup/list: snapshot keys with their session counts (the handler lives in ../backup.ts).
import { list, type Ctx } from '../backup';

export const onRequest = (ctx: Ctx) => list(ctx);
