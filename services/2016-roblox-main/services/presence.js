import request, { getFullUrl } from "../lib/request"
import axios from "axios";

/**
 * Multi-get presence for the userIds
 * @param {{userIds: (number | string)[]}} param0
 * @returns {Promise<{userPresenceType: string; lastLocation: string; placeId: number | null; gameId: number | null; userId: number; lastOnline: string;}[]>}
 */
export const multiGetPresence = ({ userIds }) => {
  // Local Supabase-backed presence (recent online_at = Online).
  return axios.post('/api/web/presence', { userIds }).then(d => d.data.userPresences);
}
