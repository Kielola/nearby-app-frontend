import { apiRequest } from './httpClient';
import { UploadSignature } from './types';

export const mediaApi = {
  getUploadSignature: (folder = 'nearby/uploads') =>
    apiRequest<UploadSignature>('/media/upload-signature', { query: { folder } }),

  setProfilePicture: (url: string) =>
    apiRequest('/media/profile-picture', { method: 'POST', body: { url } }),

  // Uploads a file DIRECTLY to Cloudinary using a signature from our
  // backend — the file bytes never touch our server. This replaces the
  // old unsigned-upload-preset approach (which trusts the client and
  // can be abused to upload arbitrary content to your Cloudinary account).
  async uploadFile(file: File, folder = 'nearby/uploads'): Promise<string> {
    const sig = await mediaApi.getUploadSignature(folder);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', sig.apiKey);
    formData.append('timestamp', String(sig.timestamp));
    formData.append('signature', sig.signature);
    formData.append('folder', sig.folder);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`,
      { method: 'POST', body: formData },
    );

    if (!response.ok) {
      throw new Error('Upload to Cloudinary failed');
    }

    const result = await response.json();
    return result.secure_url as string;
  },
};
