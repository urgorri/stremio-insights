export function parsePlayerHash(hash: string) {
  if (!hash || !hash.includes("#/player/")) return null;

  const parts = hash.split("/");
  if (parts.length >= 6) {
    const type = parts[3];
    if (type !== "movie" && type !== "series") return null;

    const parent_id = parts[4];
    const video_id = parts[5];

    let season: number | undefined;
    let episode: number | undefined;

    if (type === "series" && video_id.includes(":")) {
      const idParts = video_id.split(":");
      if (idParts.length >= 3) {
        season = Number(idParts[1]);
        episode = Number(idParts[2]);
      }
    }

    return {
      imdb_id: video_id,
      parent_id,
      type: type as "movie" | "series",
      season,
      episode
    };
  }
  return null;
}
