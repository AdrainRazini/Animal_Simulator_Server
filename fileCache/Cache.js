const memoryCache = {
  musics_obj: { data: [], lastFetch: 0 },
  musics: { data: [], lastFetch: 0 },
  players: { data: [], lastFetch: 0 },
  online:{ data:[], lastFetch: 0}
};

const CACHE_TTL = 5 * 60 * 60 * 1000; // 5 h

export {memoryCache, CACHE_TTL}