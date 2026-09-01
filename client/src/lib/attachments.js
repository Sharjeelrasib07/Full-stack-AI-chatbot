// attachments.js
// Helpers for turning a picked image file into a small base64 data URL
// (resized client-side so it's cheap to send to the vision model and cheap
// to store in localStorage), and for the small set of file types the
// document-upload flow accepts.

const MAX_IMAGE_DIMENSION = 1024;
const IMAGE_QUALITY = 0.8;

// Resizes an image file down to at most MAX_IMAGE_DIMENSION on its longest
// side and returns it as a JPEG data URL. Keeping this small matters twice
// over: OpenAI's vision input is billed/limited by image size, and the
// result gets stored in localStorage where a handful of full-resolution
// phone photos would blow past the browser's quota.
export function resizeImageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file doesn't look like a valid image."));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          if (width >= height) {
            height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
            width = MAX_IMAGE_DIMENSION;
          } else {
            width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
            height = MAX_IMAGE_DIMENSION;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", IMAGE_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export const ACCEPTED_DOCUMENT_TYPES = ".pdf,.doc,.docx,.txt";

export function isImageFile(file) {
  return file.type.startsWith("image/");
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
