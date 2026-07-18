# KB Media (Video + Audio) — Cutover checklist 029

Do **not** auto-apply. Apply manually in Supabase SQL editor after backup.

## Prerequisites
- Patch **027** (attachments table + `knowledge-base` bucket) already applied
- App deploy includes media UI (Video/Audio menu + Files panel recorder)

## Steps
1. **Backup** relevant tables / confirm you can restore
2. Run `SPIORA_SUPABASE_PATCH_029_KNOWLEDGE_BASE_MEDIA.sql`
3. Spot-check:
   - `knowledge_base_attachments` constraints allow `video/*` and `audio/*`
   - `file_size` check allows up to **100 MiB** (`104857600`)
   - Storage bucket `knowledge-base`: `file_size_limit = 104857600`, MIME list includes video/audio
4. Smoke test in app (owner):
   - Add material → **Video** → upload MP4/WebM ≤ 100 MB → preview plays
   - Add material → **Audio** → upload MP3/WebM ≤ 25 MB → preview plays
   - In Files: **Record audio** → stop/save → appears in list and plays
   - Reader (non-owner) on published material can preview/download; cannot upload
5. Optional rollback: `SPIORA_SUPABASE_PATCH_029_KNOWLEDGE_BASE_MEDIA_ROLLBACK.sql`  
   (fails if any video/audio rows or files > 25 MiB exist)

## Limits (Phase 1)
| Kind | Formats | Max size |
|------|---------|----------|
| Video | MP4, WebM | 100 MB |
| Audio | WebM, OGG, MP3, M4A | 25 MB |
| Record | browser MediaRecorder (usually WebM/Opus) | 10 min / 25 MB |
| Cap | same as PDF/images | 10 attachments / material |

## Out of scope
- Camera video recording
- Link materials
- Transcoding / thumbnails / CDN streaming
