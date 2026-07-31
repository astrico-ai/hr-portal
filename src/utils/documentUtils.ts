import { supabase } from '../lib/supabaseClient';

const STORAGE_BUCKET = 'documents';

// Helper function to create blob URL from base64 data
export const createBlobUrl = (base64Data: string) => {
  try {
    // Extract the actual base64 data and content type
    const [header, base64Content] = base64Data.split(',');
    if (!base64Content) {
      console.error('Invalid base64 data format');
      return null;
    }

    // Get the content type from the header
    const contentType = header.match(/data:(.*?);/)?.[1] || 'application/pdf';
    
    const byteCharacters = atob(base64Content);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: contentType });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error creating blob URL:', error);
    return null;
  }
};

// Resolve any stored document reference to an openable URL. Handles all three
// forms transparently, so the migration from base64 → Storage needs no changes
// at the call sites:
//   • "data:...base64,..."  → legacy/Firebase inline blob
//   • "http(s)://..."       → already a full URL
//   • otherwise             → a Supabase Storage path → short-lived signed URL
export const resolveDocumentUrl = async (ref: string): Promise<string | null> => {
  if (!ref) return null;
  if (ref.startsWith('data:')) return createBlobUrl(ref);
  if (/^https?:\/\//.test(ref)) return ref;
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(ref, 120);
  if (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }
  return data?.signedUrl ?? null;
};

// Handle document click — open the resolved URL in a new tab.
export const handleDocumentClick = async (documentUrl: string) => {
  try {
    const url = await resolveDocumentUrl(documentUrl);
    if (url) {
      window.open(url, '_blank');
    } else {
      alert('Error opening document');
    }
  } catch (error) {
    console.error('Error handling document click:', error);
    alert('Error opening document');
  }
};
