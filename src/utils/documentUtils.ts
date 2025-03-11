// Helper function to create blob URL from base64 data
export const createBlobUrl = (base64Data: string) => {
  try {
    // Extract the actual base64 data (remove data:application/pdf;base64, prefix)
    const base64Content = base64Data.split(',')[1];
    const byteCharacters = atob(base64Content);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error creating blob URL:', error);
    return null;
  }
};

// Helper function to handle document clicks
export const handleDocumentClick = (documentUrl: string) => {
  try {
    // If it's already a blob URL, open it directly
    if (documentUrl.startsWith('blob:')) {
      window.open(documentUrl, '_blank');
      return;
    }

    // If it's a base64 string, convert to blob URL and open
    const blobUrl = createBlobUrl(documentUrl);
    if (blobUrl) {
      window.open(blobUrl, '_blank');
      // Clean up the blob URL after opening
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } else {
      throw new Error('Failed to create blob URL');
    }
  } catch (error) {
    console.error('Error handling document click:', error);
    alert('Error opening document');
  }
}; 