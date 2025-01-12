import mongoose from 'mongoose';

// Enums for better type safety
export enum ContentRating {
  Safe = 'safe',
  Suggestive = 'suggestive',
  Erotica = 'erotica',
  Pornographic = 'pornographic'
}

export enum MangaStatus {
  Ongoing = 'ongoing',
  Completed = 'completed',
  Hiatus = 'hiatus',
  Cancelled = 'cancelled'
}

// Interfaces
export interface Chapter {
  chapterId: string;
  number: string;
  title: string | null;
  volume: string | null;
  pages: string[];
  publishedAt: Date;
  description?: string;
  pagesLoaded?: boolean;
}

// Schema definitions
const chapterSchema = new mongoose.Schema<Chapter>({
  chapterId: { type: String, required: true },
  number: { type: String, required: true },
  title: String,
  pages: [String],
  publishedAt: Date,
  pagesLoaded: { type: Boolean, default: false }
});

const mangaSchema = new mongoose.Schema({
  mangadexId: {
    type: String,
    required: true,
    unique: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
    default: 'No description available.',
  },
  contentRating: {
    type: String,
    required: true,
    enum: Object.values(ContentRating),
    default: ContentRating.Safe,
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(MangaStatus),
    default: MangaStatus.Ongoing,
  },
  tags: {
    type: [String],
    default: [],
  },
  authors: {
    type: [String],
    default: [],
  },
  artists: {
    type: [String],
    default: [],
  },
  coverUrl: String,
  coverFileName: String,
  chapters: {
    type: [chapterSchema],
    default: [],
  },
  rating: {
    type: Number,
    min: 0,
    max: 10,
  }
}, {
  timestamps: true,
});

// Indexes
mangaSchema.index({ title: 'text', description: 'text', authors: 'text', tags: 'text' });
mangaSchema.index({ mangadexId: 1 }, { unique: true });
mangaSchema.index({ status: 1 });
mangaSchema.index({ contentRating: 1 });
mangaSchema.index({ updatedAt: -1 });

// Interfaces for methods and document
interface MangaMethods {
  needsPageLoad(chapterId: string): boolean;
  markChapterPagesLoaded(chapterId: string, success: boolean): Promise<this>;
}

interface MangaDocument extends mongoose.Document {
  mangadexId: string;
  title: string;
  description: string;
  contentRating: ContentRating;
  status: MangaStatus;
  tags: string[];
  authors: string[];
  artists: string[];
  coverUrl?: string;
  coverFileName?: string;
  chapters: Chapter[];
  rating?: number;
  createdAt: Date;
  updatedAt: Date;
  needsPageLoad(chapterId: string): boolean;
  markChapterPagesLoaded(chapterId: string, success: boolean): Promise<this>;
}

// Methods
mangaSchema.methods.needsPageLoad = function(this: MangaDocument, chapterId: string): boolean {
  const chapter = this.chapters.find((ch: Chapter) => ch.chapterId === chapterId);
  return !chapter || !chapter.pagesLoaded || chapter.pages.length === 0;
};

mangaSchema.methods.markChapterPagesLoaded = async function(this: MangaDocument, chapterId: string, success: boolean) {
  const chapter = this.chapters.find((ch: Chapter) => ch.chapterId === chapterId);
  if (chapter) {
    chapter.pagesLoaded = success;
    await this.save();
  }
  return this;
};

// Types and exports
export type MangaModel = mongoose.Model<MangaDocument, {}, MangaMethods>;

export const MangaModel = (mongoose.models.Manga || mongoose.model('Manga', mangaSchema)) as MangaModel;

export type Manga = MangaDocument & MangaMethods;