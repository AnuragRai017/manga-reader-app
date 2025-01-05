export interface User {
  _id?: string;
  username: string;
  email: string;
  password: string; // This will be hashed
  createdAt: Date;
  updatedAt: Date;
}

export interface UserResponse {
  _id: string;
  username: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
} 