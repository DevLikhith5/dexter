export async function uploadToCloudinary(file: File): Promise<string> {
    const cloudName = import.meta.env.VITE_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
        throw new Error('Cloudinary configuration missing. Please check CLOUD_NAME and UPLOAD_PRESET in .env file');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    let lastError: any;

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
            {
                method: "POST",
                body: formData,
            }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `Upload failed with status ${response.status}`);
            }

            const data = await response.json();
            return data.secure_url;

        } catch (error) {
            console.warn(`Cloudinary upload attempt ${attempt} failed:`, error);
            lastError = error;
            if (attempt < 3) {
                // Wait briefly before retrying
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }

    console.error('Cloudinary upload completely failed after 3 attempts:', lastError);
    throw lastError instanceof Error 
        ? lastError 
        : new Error('Failed to upload file to Cloudinary');
}
