import { ObjectId } from 'mongodb';

export interface Manga {
  _id: ObjectId;
  mangadexId: string;
  title: string;
  description: string;
  coverUrl?: string;
  coverFileName?: string;
  contentRating: string;
  tags: string[];
  authors: string[];
  artists: string[];
  status: string;
  chapters: any[];
  createdAt: Date;
  updatedAt: Date;
  rating?: number; // Add this property
  // ... other properties
}

export interface Chapter {
  _id?: string;
  mangaId: string;
  chapterNumber: number;
  title: string;
  pages: string[];
  uploadDate: Date;
}

export interface MangaData {
  id: string;
  title: string;
  description?: string;
  status?: string;
  chapters?: any[];
  // ...other fields...
}