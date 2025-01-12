## Chapter Reading Routes

### Current Route Structure
Chapters are accessed through the following URL structure:
`/manga/:mangaId/chapter/:chapterId`

Example: `/manga/123/chapter/456`

### Deprecated Routes
The following route is deprecated and will automatically redirect to the new format:
- `/read/:mangaId/:chapterId` → `/manga/:mangaId/chapter/:chapterId`

### Route Parameters
- `mangaId`: The unique identifier for the manga
- `chapterId`: The unique identifier for the chapter

### Features
- Progressive image loading
- Chapter navigation
- Reading progress tracking
- Page preloading 