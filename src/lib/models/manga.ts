import mongoose from "mongoose";
const {Schema, model, models,Model} = mongoose;

export interface Chapter {
  chapterId: string;
  number?: string;
  title?: string;
  publishedAt?: Date | string;
  pages: string[];
  // other chapter properties
}

export interface Manga {
  mangadexId: string;
  title: string;
  description: string;
  status: string;
  contentRating: string;
  tags: string[];
  authors: string[];
  artists: string[];
  coverUrl?: string;
  coverFileName?: string;
  chapters: Chapter[];
  createdAt: Date;
  updatedAt: Date;
}

const mangaSchema = new Schema<Manga>({
  mangadexId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, required: true },
  contentRating: { type: String, required: true },
  tags: [{ type: String }],
  authors: [{ type: String }],
  artists: [{ type: String }],
  coverUrl: String,
  coverFileName: String,
  chapters: [{
    chapterId: { type: String, required: true },
    number: { type: String, required: true },
    title: String,
    volume: String,
    pages: [{ type: String }],
    publishedAt: { type: Date, required: true }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add indexes for better query performance
mangaSchema.index({ title: 'text', description: 'text', authors: 'text', tags: 'text' });
mangaSchema.index({ mangadexId: 1 }, { unique: true });
mangaSchema.index({ status: 1 });
mangaSchema.index({ contentRating: 1 });
mangaSchema.index({ updatedAt: -1 });

// Update the model export to use the imported types
export const MangaModel: typeof Model = models.Manga || model<Manga>('Manga', mangaSchema);