export async function listStorageObjects(storage, bucket, prefix = "", pageSize = 1000) {
  const objects = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await storage.from(bucket).list(prefix, {
      limit: pageSize, offset, sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Cannot list ${bucket}/${prefix}: ${error.message}`);
    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (!entry.id && !entry.metadata) {
        objects.push(...await listStorageObjects(storage, bucket, path, pageSize));
      } else {
        const size = Number(entry.metadata?.size);
        if (!Number.isSafeInteger(size) || size < 0) throw new Error(`Unknown object size: ${bucket}/${path}`);
        objects.push({ bucket, path, size, id: entry.id, updatedAt: entry.updated_at, contentType: entry.metadata?.mimetype });
      }
    }
    if ((data ?? []).length < pageSize) break;
  }
  return objects;
}

export function matchesSource(object, destination) {
  return destination.ContentLength === object.size &&
    destination.Metadata?.["supabase-id"] === object.id &&
    destination.Metadata?.["supabase-updated-at"] === object.updatedAt &&
    /^[a-f0-9]{64}$/.test(destination.Metadata?.sha256 ?? "");
}
